import { asCouchDoc, syncedDocument } from 'edge-server-tools'
import { HttpResponse } from 'serverlet'
import { ExpressRequest } from 'serverlet/express'

import { ONE_MINUTE } from './constants'
import { getRates } from './getRates'
import { dbSettings } from './providers/couch'
import {
  asCrossChainMapping,
  asIncomingGetRatesParams,
  asStringNullMap,
  CrossChainMapping,
  GetRatesParams,
  IncomingGetRatesParams
} from './types'
import { toCryptoKey } from './utils'

const fixIncomingGetRatesParams = (
  rawParams: IncomingGetRatesParams,
  rightNow: Date
): GetRatesParams => {
  const normalizeTime = Math.floor(rightNow.getTime() / ONE_MINUTE) * ONE_MINUTE
  const normalizedIsoDate = new Date(normalizeTime)

  const params = asIncomingGetRatesParams(rawParams)

  if (params.crypto.length > 100) {
    throw new Error('crypto array must be less than 100')
  }
  if (params.fiat.length > 256) {
    throw new Error('fiat array must be less than 256')
  }
  if (params.targetFiat !== 'USD') {
    throw new Error('targetFiat must be USD')
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
const applyCrossChainMappings = (
  params: GetRatesParams,
  mapping: CrossChainMapping
): {
  mappedParams: GetRatesParams
  originalToCanonicalKey: Map<string, string>
} => {
  const originalToCanonicalKey = new Map<string, string>()
  const mappedCrypto = params.crypto.map(c => {
    const originalKey = toCryptoKey(c.asset)
    const cross = mapping[originalKey]
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

const crosschainMappings = syncedDocument(
  'crosschain:automated',
  asCrossChainMapping
)
crosschainMappings.sync(dbSettings).catch(e => {
  console.error('crosschainMappings sync error', e)
})

export const ratesV3 = async (
  request: ExpressRequest
): Promise<HttpResponse> => {
  try {
    const rightNow = new Date()
    const params = fixIncomingGetRatesParams(request.req.body, rightNow)

    // Map all incoming crypto assets to their canonical versions
    const { mappedParams, originalToCanonicalKey } = applyCrossChainMappings(
      params,
      crosschainMappings.doc
    )
    const result = await getRates(mappedParams, rightNow)

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
