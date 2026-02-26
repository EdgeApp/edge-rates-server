import { asArray, asMaybe, asNumber, asObject, asString } from 'cleaners'
import { asCouchDoc, type CouchDoc, syncedDocument } from 'edge-server-tools'

import { coinrankEngine } from '../../../coinrankEngine'
import { config } from '../../../config'
import { REDIS_COINRANK_KEY_PREFIX } from '../../../constants'
import { coingeckoAssetsInternal } from '../../../providers/coingecko'
import type { AssetMap } from '../../../rates'
import type { CoinrankMarkets } from '../../../types'
import { hsetAsync } from '../../../utils/dbUtils'
import { dateOnly, logger, snooze } from '../../../utils/utils'
import {
  NETWORK_LOCATION_TYPES_KEY,
  TOKEN_OVERRIDES_KEY,
  TOKEN_TYPES_KEY
} from '../../constants'
import {
  asCrossChainDoc,
  asNetworkLocationTypeMap,
  asNumberMap,
  asStringNullMap,
  asTokenInfoDoc,
  asTokenMap,
  asTokenMappingsDoc,
  asTokenOverride,
  asTokenTypeMap,
  type CrossChainMapping,
  type EdgeTokenInfo,
  type NumberMap,
  type RateBuckets,
  type RateEngine,
  type RateProvider,
  type TokenMap,
  tokenOverrideToEdgeTokenInfo,
  wasCrossChainDoc,
  wasExistingMappings,
  wasTokenInfoDoc
} from '../../types'
import {
  create30MinuteSyncInterval,
  createTokenId,
  expandReturnedCryptoRates,
  isCurrent,
  reduceRequestedCryptoRates,
  toCryptoKey
} from '../../utils'
import { dbSettings, dbTokens } from '../couch'
import { getAsync } from '../redis'
import { getNetworkLocation } from './currencyUtils'
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

const asTokenList = asObject({
  tokens: asArray(
    asObject({
      // chainId: asEither(asNumber, asNull),
      address: asString,
      name: asString,
      symbol: asString,
      decimals: asNumber
      // logoURI: asString
    })
  )
})

// Builds token info documents by merging CoinGecko token lists with manual
// overrides, then writes only new or changed documents to CouchDB.
// NetworkLocation is carried forward from existing docs to avoid redundant
// RPC calls (e.g. Solana getAccountInfo) on every run; it is only fetched
// for genuinely new tokens.
const updateTokenInfos = async (): Promise<void> => {
  const newTokenInfoDocs: Array<CouchDoc<EdgeTokenInfo>> = []
  const mergedTokenInfos = new Map<string, EdgeTokenInfo>()

  const coingeckoIdsDocument = await dbSettings.get('coingecko:automated')
  const coingeckoIds = asTokenMappingsDoc(coingeckoIdsDocument).doc

  const tokenTypesDoc = await dbSettings.get(TOKEN_TYPES_KEY)
  const tokenTypes = asCouchDoc(asStringNullMap)(tokenTypesDoc).doc

  const crosschainDocument = await dbSettings.get('crosschain:automated')
  const crosschain = asCrossChainDoc(crosschainDocument).doc

  const networkLocationTypesDoc = await dbSettings.get(
    NETWORK_LOCATION_TYPES_KEY
  )
  const networkLocationTypes = asCouchDoc(asNetworkLocationTypeMap)(
    networkLocationTypesDoc
  ).doc

  const coinranksStr = await getAsync(`${REDIS_COINRANK_KEY_PREFIX}_iso:USD`)
  if (coinranksStr == null) return
  const coinrankMarkets: CoinrankMarkets = JSON.parse(coinranksStr)?.markets
  const idRankMap = new Map<string, number | null>()
  for (const market of coinrankMarkets) {
    idRankMap.set(market.assetId, market.rank)
  }

  for (const [edgePluginId, platform] of Object.entries(
    platformIdMappingSyncDoc.doc
  )) {
    const tokenType = tokenTypes[edgePluginId]
    if (platform == null || tokenType == null) continue

    try {
      const response = await fetchCoingecko(
        `${config.providers.coingeckopro.uri}/api/v3/token_lists/${platform}/all.json`
      )
      const tokenList = asTokenList(response).tokens

      for (const token of tokenList) {
        const tokenId = createTokenId(tokenType, token.symbol, token.address)
        if (tokenId == null) continue
        const cryptoKey = toCryptoKey({ pluginId: edgePluginId, tokenId })
        if (coingeckoIds[cryptoKey] == null) continue

        let id: string | undefined = coingeckoIds[cryptoKey]?.id
        if (id == null) {
          const crosschainAsset = crosschain[cryptoKey]
          if (crosschainAsset != null) {
            const crosschainKey = toCryptoKey({
              pluginId: crosschainAsset.destChain,
              tokenId: crosschainAsset.tokenId
            })
            id = coingeckoIds[crosschainKey]?.id
          }
        }

        const rank = idRankMap.get(id) ?? Number.MAX_SAFE_INTEGER

        const newInfo: EdgeTokenInfo = {
          rank,
          contractAddress: token.address,
          currencyCode: token.symbol,
          displayName: token.name,
          decimals: token.decimals,
          networkLocation: undefined,
          chainPluginId: edgePluginId,
          tokenId
        }
        mergedTokenInfos.set(cryptoKey, newInfo)
      }
    } catch (error) {
      logger(`${edgePluginId} ${platform} tokenList failure`, error)
    }
  }

  const tokenOverridesDocument = await dbSettings.get(TOKEN_OVERRIDES_KEY)
  const tokenOverrides = asCouchDoc(asObject(asArray(asTokenOverride)))(
    tokenOverridesDocument
  ).doc

  for (const [pluginId, tokens] of Object.entries(tokenOverrides)) {
    const tokenType = tokenTypes[pluginId]
    if (tokenType == null) continue

    for (const token of tokens) {
      const overrideInfo = tokenOverrideToEdgeTokenInfo(
        token,
        pluginId,
        tokenType
      )
      if (overrideInfo == null) continue

      const cryptoKey = toCryptoKey({
        pluginId,
        tokenId: overrideInfo.tokenId
      })
      const coingeckoTokenInfo = mergedTokenInfos.get(cryptoKey)

      // Coingecko priority: rank/contractAddress
      // Manual priority: currencyCode/decimals/displayName/networkLocation.
      if (coingeckoTokenInfo == null) {
        mergedTokenInfos.set(cryptoKey, overrideInfo)
      } else {
        mergedTokenInfos.set(cryptoKey, {
          ...coingeckoTokenInfo,
          currencyCode: overrideInfo.currencyCode,
          decimals: overrideInfo.decimals,
          displayName: overrideInfo.displayName,
          networkLocation: overrideInfo.networkLocation
        })
      }
    }
  }

  const hasTokenInfoChange = (
    existing: EdgeTokenInfo,
    next: EdgeTokenInfo
  ): boolean => {
    return (
      existing.rank !== next.rank ||
      existing.contractAddress !== next.contractAddress ||
      existing.currencyCode !== next.currencyCode ||
      existing.displayName !== next.displayName ||
      existing.decimals !== next.decimals ||
      JSON.stringify(existing.networkLocation ?? null) !==
        JSON.stringify(next.networkLocation ?? null) ||
      existing.chainPluginId !== next.chainPluginId ||
      existing.tokenId !== next.tokenId
    )
  }

  const keys = Array.from(mergedTokenInfos.keys())
  const existingDocs = await dbTokens.fetch({ keys })

  const existingMap = new Map<string, { doc: EdgeTokenInfo; rev: string }>()
  for (const row of existingDocs.rows) {
    if ('error' in row || row.doc == null) continue
    const parsed = asMaybe(asTokenInfoDoc)(row.doc)
    if (parsed == null) continue
    existingMap.set(row.id, { doc: parsed.doc, rev: row.doc._rev })
  }

  for (const [cryptoKey, newInfo] of mergedTokenInfos) {
    const existing = existingMap.get(cryptoKey)
    if (existing != null) {
      newInfo.networkLocation ??= existing.doc.networkLocation
      if (hasTokenInfoChange(existing.doc, newInfo)) {
        newTokenInfoDocs.push(
          wasTokenInfoDoc({
            doc: newInfo,
            id: cryptoKey,
            rev: existing.rev
          })
        )
      }
    } else {
      const networkLocation = await getNetworkLocation(
        networkLocationTypes[newInfo.chainPluginId] ?? null,
        newInfo.contractAddress
      )
      if (networkLocation != null) {
        newInfo.networkLocation = networkLocation
        newTokenInfoDocs.push(
          wasTokenInfoDoc({
            doc: newInfo,
            id: cryptoKey
          })
        )
      }
    }
  }

  if (newTokenInfoDocs.length > 0) {
    await dbTokens.bulk({
      docs: newTokenInfoDocs
    })
  }
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

const coingeckoAssetsEngine: RateEngine = async () => {
  const assets = await coingeckoAssetsInternal(3000)
  const assetMap: AssetMap = {}
  for (const asset of assets) {
    const currencyCode = asset.symbol.toUpperCase()
    const { id } = asset
    assetMap[currencyCode] ??= id
  }
  await hsetAsync('coingeckoassets', assetMap)
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
    },
    {
      frequency: 120,
      engine: async () => {
        await coinrankEngine(true)
      }
    },
    {
      frequency: 'day',
      engine: coingeckoAssetsEngine
    },
    {
      frequency: 'hour',
      engine: updateTokenInfos
    }
  ]
}
