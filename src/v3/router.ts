import { syncedDocument } from 'edge-server-tools'
import type { HttpResponse } from 'serverlet'
import type { ExpressRequest } from 'serverlet/express'

import { config } from '../config'
import { slackPoster } from '../utils/postToSlack'
import { CRYPTO_LIMIT, FIAT_LIMIT, ONE_MINUTE } from './constants'
import { getRates } from './getRates'
import { dbSettings } from './providers/couch'
import {
  asCrossChainMapping,
  asGetRatesParams,
  asIncomingGetRatesParams,
  asV2CurrencyCodeMapDoc,
  type CrossChainMapping,
  type CryptoRate,
  type FiatRate,
  type GetRatesParams,
  type IncomingGetRatesParams,
  type V2CurrencyCodeMapDoc
} from './types'
import { create30MinuteSyncInterval, toCryptoKey } from './utils'

const fixIncomingGetRatesParams = (
  rawParams: IncomingGetRatesParams,
  rightNow: Date
): GetRatesParams => {
  const normalizeTime = Math.floor(rightNow.getTime() / ONE_MINUTE) * ONE_MINUTE
  const normalizedIsoDate = new Date(normalizeTime)

  const params = asIncomingGetRatesParams(rawParams)

  if (params.crypto.length > CRYPTO_LIMIT) {
    throw new Error(`crypto array must be less than ${CRYPTO_LIMIT}`)
  }
  if (params.fiat.length > FIAT_LIMIT) {
    throw new Error(`fiat array must be less than ${FIAT_LIMIT}`)
  }

  params.crypto.forEach(crypto => {
    // Sanity check that the tokenId doesn't include _
    if (
      typeof crypto.asset.tokenId === 'string' &&
      crypto.asset.tokenId.includes('_')
    ) {
      throw new Error('tokenId cannot include _')
    }
    if (crypto.isoDate == null) {
      crypto.isoDate = normalizedIsoDate
    }
  })
  params.fiat.forEach(fiat => {
    if (fiat.isoDate == null) {
      fiat.isoDate = normalizedIsoDate
    }
  })

  return params as GetRatesParams
}

// Map incoming crypto assets to their cross-chain canonical versions
// Also return a mapping from each original asset key to its canonical key
let crosschainMappings: CrossChainMapping = {}
export const v2CurrencyCodeMap: V2CurrencyCodeMapDoc = { data: {} }

const applyCrossChainMappings = (
  params: GetRatesParams
): {
  mappedParams: GetRatesParams
  originalToCanonicalKey: Map<string, string>
} => {
  const originalToCanonicalKey = new Map<string, string>()
  const mappedCrypto = params.crypto.map(c => {
    const originalKey = toCryptoKey(c.asset)
    const cross = crosschainMappings[originalKey]
    if (cross == null) {
      originalToCanonicalKey.set(originalKey, originalKey)
      return c
    }
    const canonicalAsset = {
      pluginId: cross.destChain,
      tokenId: cross.tokenId
    }
    const canonicalKey = toCryptoKey(canonicalAsset)
    originalToCanonicalKey.set(originalKey, canonicalKey)
    return {
      ...c,
      asset: canonicalAsset
    }
  })
  return {
    mappedParams: { ...params, crypto: mappedCrypto },
    originalToCanonicalKey
  }
}

export const v2CurrencyCodeMapSyncDoc = syncedDocument(
  'v2CurrencyCodeMap',
  asV2CurrencyCodeMapDoc
)
const defaultCrossChainSyncDoc = syncedDocument(
  'crosschain',
  asCrossChainMapping
)
const automatedCrossChainSyncDoc = syncedDocument(
  'crosschain:automated',
  asCrossChainMapping
)
create30MinuteSyncInterval(defaultCrossChainSyncDoc, dbSettings)
create30MinuteSyncInterval(automatedCrossChainSyncDoc, dbSettings)
create30MinuteSyncInterval(v2CurrencyCodeMapSyncDoc, dbSettings)
v2CurrencyCodeMapSyncDoc.onChange(ccm => {
  v2CurrencyCodeMap.data = ccm.data
})
defaultCrossChainSyncDoc.onChange(defaultMappings => {
  crosschainMappings = {
    ...automatedCrossChainSyncDoc.doc,
    ...defaultMappings
  }
})
automatedCrossChainSyncDoc.onChange(automatedMappings => {
  crosschainMappings = {
    ...automatedMappings,
    ...defaultCrossChainSyncDoc.doc
  }
})

export const toDatedFiatKey = (asset: FiatRate): string => {
  return `${asset.isoDate.toISOString()}_${asset.fiatCode}`
}
export const toDatedCryptoKey = (asset: CryptoRate): string => {
  return `${asset.isoDate.toISOString()}_${toCryptoKey(asset.asset)}`
}
/**
 * Break up a non-USD request into two queries. The first finds all the
 * USD rates and the second finds all of the fiat/USD rates on across all
 *  the dates requested.
 */
const getNonUsdRates = async (
  initialParams: GetRatesParams,
  rightNow: Date
): Promise<GetRatesParams> => {
  // Get requested rates in USD
  const usdParams = {
    ...initialParams,
    targetFiat: 'USD'
  }
  const usdResult = await getRates(usdParams, rightNow)

  // Loop over the USD rates and store them in a map. At the same time,
  // save the date strings we'll need to query the original requested fiat for
  const usdCryptoRatesMap = new Map<string, number | undefined>()
  const dateSet = new Set<string>()
  for (const crypto of usdResult.crypto) {
    usdCryptoRatesMap.set(toDatedCryptoKey(crypto), crypto.rate)
    dateSet.add(crypto.isoDate.toISOString())
  }
  const usdFiatRatesMap = new Map<string, number | undefined>()
  for (const fiat of usdResult.fiat) {
    usdFiatRatesMap.set(toDatedFiatKey(fiat), fiat.rate)
    dateSet.add(fiat.isoDate.toISOString())
  }

  // Get fiat/USD rates
  // The number of unique dates across crypto and fiat could exceed 256 so we need to chunk them
  const dateArray = Array.from(dateSet)
  const chunkSize = FIAT_LIMIT
  const fiatUsdDateExchangeRateMap = new Map<string, number | undefined>()
  for (let i = 0; i < dateArray.length; i += chunkSize) {
    const chunk = dateArray.slice(i, i + chunkSize)
    const fiatParams = {
      targetFiat: 'USD',
      crypto: [],
      fiat: chunk.map(date => ({
        isoDate: new Date(date),
        fiatCode: initialParams.targetFiat,
        rate: undefined
      }))
    }
    const fiatResult = await getRates(fiatParams, rightNow)
    for (const fiat of fiatResult.fiat) {
      fiatUsdDateExchangeRateMap.set(fiat.isoDate.toISOString(), fiat.rate)
    }
  }

  // Loop over the initial request and bridge the rates
  for (const crypto of initialParams.crypto) {
    const usdCryptoRate = usdCryptoRatesMap.get(toDatedCryptoKey(crypto))
    const fiatRate = fiatUsdDateExchangeRateMap.get(
      crypto.isoDate.toISOString()
    )
    if (usdCryptoRate == null || fiatRate == null) continue
    crypto.rate = usdCryptoRate / fiatRate
  }
  for (const fiat of initialParams.fiat) {
    const usdFiatRate = usdFiatRatesMap.get(toDatedFiatKey(fiat))
    const fiatRate = fiatUsdDateExchangeRateMap.get(fiat.isoDate.toISOString())
    if (usdFiatRate == null || fiatRate == null) continue
    fiat.rate = usdFiatRate / fiatRate
  }

  return initialParams
}

export const ratesV3 = async (
  request: ExpressRequest
): Promise<HttpResponse> => {
  try {
    const rightNow = new Date()
    const params = fixIncomingGetRatesParams(request.req.body, rightNow)

    // Map all incoming crypto assets to their canonical versions
    const { mappedParams, originalToCanonicalKey } =
      applyCrossChainMappings(params)

    const result =
      mappedParams.targetFiat === 'USD'
        ? await getRates(mappedParams, rightNow)
        : await getNonUsdRates(mappedParams, rightNow)

    // Build a quick lookup from canonical key + isoDate -> rate
    const canonicalLookup = new Map<string, number>()
    for (const r of result.crypto) {
      if (r.rate == null) continue
      const key = `${r.isoDate.toISOString()}_${toCryptoKey(r.asset)}`
      canonicalLookup.set(key, r.rate)
    }

    // Rebuild crypto results for the original requested assets
    const remappedCrypto = params.crypto.map(c => {
      const originalKey = toCryptoKey(c.asset)
      const maybeCanonical = originalToCanonicalKey.get(originalKey)
      const canonicalKey = maybeCanonical ?? originalKey
      const lookupKey = `${c.isoDate.toISOString()}_${canonicalKey}`
      const rate = canonicalLookup.get(lookupKey)
      return {
        isoDate: c.isoDate,
        asset: c.asset,
        rate
      }
    })

    return {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        targetFiat: params.targetFiat,
        crypto: remappedCrypto,
        fiat: result.fiat
      })
    }
  } catch (e) {
    return {
      status: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: `Invalid request body ${String(e)}` })
    }
  }
}

export const heartbeatV3 = async (
  request: ExpressRequest
): Promise<HttpResponse> => {
  const testData = {
    targetFiat: 'USD',
    crypto: [
      {
        asset: {
          pluginId: 'bitcoin',
          tokenId: null
        }
      }
    ],
    fiat: [
      {
        fiatCode: 'EUR'
      }
    ]
  }

  const response = await fetch(
    `http://${config.httpHost}:${config.httpPort}/v3/rates`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    }
  )

  if (!response.ok) {
    return {
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch rates' })
    }
  }

  const json = await response.json()
  const data = asGetRatesParams(json)
  const btcRate = data.crypto.find(c => c.asset.pluginId === 'bitcoin')
  const eurRate = data.fiat.find(f => f.fiatCode === 'EUR')
  if (btcRate == null || eurRate == null) {
    slackPoster('Rates server heartbeat failed').catch(console.error)
    return {
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch rates' })
    }
  }

  return {
    status: response.status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(json)
  }
}
