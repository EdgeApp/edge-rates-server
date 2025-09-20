import { asArray, asMaybe, asNumber, asObject, asString } from 'cleaners'
import { asCouchDoc, syncedDocument } from 'edge-server-tools'

import { config } from '../../../config'
import { dateOnly, snooze } from '../../../utils/utils'
import { TOKEN_TYPES_KEY } from '../../constants'
import {
  asCrossChainDoc,
  asNumberMap,
  asStringNullMap,
  asTokenMap,
  asTokenTypeMap,
  type CrossChainMapping,
  type NumberMap,
  type RateBuckets,
  type RateEngine,
  type RateProvider,
  type TokenMap,
  wasCrossChainDoc,
  wasExistingMappings
} from '../../types'
import {
  create30MinuteSyncInterval,
  createTokenId,
  expandReturnedCryptoRates,
  isCurrent,
  reduceRequestedCryptoRates,
  toCryptoKey
} from '../../utils'
import { dbSettings } from '../couch'
import {
  coingeckoMainnetCurrencyMapping,
  coingeckoPlatformIdMapping
} from './defaultPluginIdMapping'

const fetchCoingecko = async (
  input: RequestInfo,
  init: RequestInit = {}
): Promise<unknown> => {
  const headers = {
    'x-cg-pro-api-key': config.providers.coingeckopro.apiKey
  }
  let retryCount = 0
  while (true) {
    const response = await fetch(input, { headers, ...init })

    if (response.status === 429) {
      await snooze(1000)
      retryCount++
      if (retryCount > 2) {
        throw new Error('coingecko rate limit exceeded')
      }
      continue // retry
    }

    if (!response.ok) {
      const message = await response.text()
      throw new Error(`coingecko failed to fetch: ${message}`)
    }

    const json = await response.json()
    return json
  }
}

const asCoingeckoAssetResponse = asArray(
  asObject({
    id: asString,
    symbol: asString,
    name: asString,
    platforms: asObject(asString)
  })
)

const asGeckoBulkUsdResponse = asObject(
  asObject({
    usd: asMaybe(asNumber)
  })
)

const asCoingeckoHistoricalUsdResponse = asObject({
  market_data: asObject({
    current_price: asObject({
      usd: asNumber
    })
  })
})

const createDefaultTokenMappings = (): TokenMap => {
  const out: TokenMap = {}

  // Add the mainnet currency mapping
  for (const [key, value] of Object.entries(coingeckoMainnetCurrencyMapping)) {
    if (value === null) continue
    out[key] = {
      id: value,
      displayName: key
    }
  }
  return out
}

let coingeckoTokenIdMap = createDefaultTokenMappings()

const manualTokenMappingsSyncDoc = syncedDocument('coingecko', asTokenMap)
const automatedTokenMappingsSyncDoc = syncedDocument(
  'coingecko:automated',
  asTokenMap
)
const platformIdMappingSyncDoc = syncedDocument(
  'coingecko:platforms',
  asStringNullMap
)
create30MinuteSyncInterval(manualTokenMappingsSyncDoc, dbSettings)
create30MinuteSyncInterval(automatedTokenMappingsSyncDoc, dbSettings)
create30MinuteSyncInterval(platformIdMappingSyncDoc, dbSettings)
manualTokenMappingsSyncDoc.onChange(manualMappings => {
  coingeckoTokenIdMap = {
    ...automatedTokenMappingsSyncDoc.doc,
    ...manualMappings
  }
})
automatedTokenMappingsSyncDoc.onChange(automatedMappings => {
  coingeckoTokenIdMap = {
    ...automatedMappings,
    ...manualTokenMappingsSyncDoc.doc
  }
})

const tokenMapping: RateEngine = async () => {
  const uidMapping: TokenMap = {}
  const crossChainMapping: CrossChainMapping = {}

  // Add the mainnet currency mapping
  for (const [key, value] of Object.entries(coingeckoMainnetCurrencyMapping)) {
    if (value === null) continue
    uidMapping[key] = {
      id: value,
      displayName: key
    }
  }

  const json = await fetchCoingecko(
    `${config.providers.coingeckopro.uri}/api/v3/coins/list?include_platform=true`
  )
  const tokenTypes = asCouchDoc(asTokenTypeMap)(
    await dbSettings.get(TOKEN_TYPES_KEY)
  )

  const data = asCoingeckoAssetResponse(json)

  const invertPlatformMapping: Record<string, string> = {}
  for (const [key, value] of Object.entries(platformIdMappingSyncDoc.doc)) {
    if (value === null) continue
    invertPlatformMapping[value] = key
  }

  const platformPriorityDoc = await dbSettings.get('platformPriority')
  const platformPriority = asCouchDoc(asNumberMap)(platformPriorityDoc).doc
  const getPriority = (k: string): number =>
    platformPriority[k] ?? Number.MAX_SAFE_INTEGER

  for (const asset of data) {
    const platforms = Object.entries(asset.platforms)

    const sortedPlatforms = platforms.sort(
      (a, b) =>
        getPriority(invertPlatformMapping[a[0]]) -
        getPriority(invertPlatformMapping[b[0]])
    )

    let destAsset: { destChain: string; edgeTokenId: string } | undefined

    for (const [platform, address] of sortedPlatforms) {
      const edgePluginId = invertPlatformMapping[platform]
      if (edgePluginId == null) continue

      const tokenType = tokenTypes.doc[edgePluginId]
      if (tokenType == null) continue

      try {
        const tokenId = createTokenId(tokenType, asset.symbol, address)
        if (tokenId == null) continue

        // Build cross-chain mappings and track the best platform
        if (destAsset == null) {
          destAsset = {
            destChain: edgePluginId,
            edgeTokenId: tokenId
          }
          // Create UID mapping for the best (first) platform
          uidMapping[toCryptoKey({ pluginId: edgePluginId, tokenId })] = {
            id: asset.id,
            displayName: asset.name
          }
        } else {
          crossChainMapping[`${edgePluginId}_${tokenId}`] = {
            sourceChain: edgePluginId,
            destChain: destAsset.destChain,
            currencyCode: asset.symbol,
            tokenId: destAsset.edgeTokenId
          }
        }
      } catch (error) {
        console.log('cross chain mapping error', platform, address, error)
        continue
      }
    }
  }

  const combinedTokenMappings: TokenMap = {
    ...automatedTokenMappingsSyncDoc.doc,
    ...uidMapping
  }

  await dbSettings.insert(
    wasExistingMappings({
      id: automatedTokenMappingsSyncDoc.id,
      rev: automatedTokenMappingsSyncDoc.rev,
      doc: combinedTokenMappings
    })
  )

  const crossChainDefaultDocument = await dbSettings.get('crosschain')
  const crossChainDefaultDoc = asCrossChainDoc(crossChainDefaultDocument)
  const crossChainAutoDocument = await dbSettings.get('crosschain:automated')
  const crossChainAutoDoc = asCrossChainDoc(crossChainAutoDocument)
  await dbSettings.insert(
    wasCrossChainDoc({
      id: crossChainAutoDoc.id,
      rev: crossChainAutoDoc.rev,
      doc: { ...crossChainMapping, ...crossChainDefaultDoc.doc }
    })
  )
}

const getCurrentRates = async (ids: Set<string>): Promise<NumberMap> => {
  const out: NumberMap = {}
  try {
    const json = await fetchCoingecko(
      `${
        config.providers.coingeckopro.uri
      }/api/v3/simple/price?ids=${Array.from(ids).join(',')}&vs_currencies=usd`
    )
    const data = asGeckoBulkUsdResponse(json)
    for (const [key, value] of Object.entries(data)) {
      if (value.usd != null) {
        out[key] = value.usd
      }
    }
  } catch (e) {
    console.error('coingecko current query error:', e)
  }
  return out
}

const toCoinGeckoDate = (date: string): string => {
  const [year, month, day] = dateOnly(date).split('-')
  return `${day}-${month}-${year}`
}

const getHistoricalRates = async (
  ids: Set<string>,
  date: string
): Promise<NumberMap> => {
  const coingeckoDate = toCoinGeckoDate(date)

  const out: NumberMap = {}
  const promises: Array<Promise<void>> = []
  ids.forEach(id => {
    promises.push(
      fetchCoingecko(
        `${config.providers.coingeckopro.uri}/api/v3/coins/${id}/history?date=${coingeckoDate}`
      )
        .then(json => {
          const data = asMaybe(asCoingeckoHistoricalUsdResponse)(json)
          if (data != null) {
            out[id] = data.market_data.current_price.usd
          }
        })
        .catch(e => {
          console.error('coingecko historical query error:', e)
        })
    )
  })
  await Promise.all(promises)

  return out
}

export const coingecko: RateProvider = {
  providerId: 'coingecko',
  type: 'api',
  documents: [
    {
      name: 'rates_settings',
      templates: {
        coingecko: createDefaultTokenMappings(),
        'coingecko:automated': createDefaultTokenMappings(),
        'coingecko:platforms': coingeckoPlatformIdMapping
      },
      syncedDocuments: [
        manualTokenMappingsSyncDoc,
        automatedTokenMappingsSyncDoc,
        platformIdMappingSyncDoc
      ]
    }
  ],
  getCryptoRates: async ({ targetFiat, requestedRates }, rightNow) => {
    if (targetFiat !== 'USD' || config.providers.coingeckopro.apiKey === '') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rateBuckets = reduceRequestedCryptoRates(
      requestedRates,
      rightNow,
      coingeckoTokenIdMap
    )

    const allResults: RateBuckets = new Map()
    const promises: Array<Promise<void>> = []
    rateBuckets.forEach((ids, date) => {
      if (isCurrent(new Date(date), rightNow)) {
        promises.push(
          getCurrentRates(ids).then(results => {
            allResults.set(date, results)
          })
        )
      } else {
        promises.push(
          getHistoricalRates(ids, date).then(results => {
            allResults.set(date, results)
          })
        )
      }
    })
    await Promise.all(promises)

    const out = expandReturnedCryptoRates(
      requestedRates,
      rightNow,
      allResults,
      coingeckoTokenIdMap
    )

    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  },
  engines: [
    {
      frequency: 'day',
      engine: tokenMapping
    }
  ]
}
