import { asArray, asMaybe, asNumber, asObject, asString } from 'cleaners'
import { asCouchDoc, CouchDoc, syncedDocument } from 'edge-server-tools'

import { config } from '../../../config'
import { REDIS_COINRANK_KEY_PREFIX } from '../../../constants'
import { CoinrankMarkets } from '../../../types'
import { dateOnly, logger, snooze } from '../../../utils/utils'
import { TOKEN_TYPES_KEY } from '../../constants'
import {
  asCrossChainDoc,
  asNumberMap,
  asStringNullMap,
  asTokenInfoDoc,
  asTokenMap,
  asTokenMappingsDoc,
  CrossChainMapping,
  EdgeTokenInfo,
  NumberMap,
  RateBuckets,
  RateEngine,
  RateProvider,
  StringNullMap,
  TokenMap,
  wasCrossChainDoc,
  wasExistingMappings,
  wasTokenInfoDoc
} from '../../types'
import {
  createTokenId,
  expandReturnedCryptoRates,
  isCurrent,
  reduceRequestedCryptoRates,
  toCryptoKey
} from '../../utils'
import { dbSettings, dbTokens } from '../couch'
import { getAsync } from '../redis'
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
    usd: asNumber
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
manualTokenMappingsSyncDoc.sync(dbSettings).catch(e => {
  console.error('manualTokenMappingsSyncDoc sync error', e)
})
automatedTokenMappingsSyncDoc.sync(dbSettings).catch(e => {
  console.error('automatedTokenMappingsSyncDoc sync error', e)
})
platformIdMappingSyncDoc.sync(dbSettings).catch(e => {
  console.error('platformIdMappingSyncDoc sync error', e)
})
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

const coingeckoToCrossChainMapping = async (
  coingeckoAssets: ReturnType<typeof asCoingeckoAssetResponse>,
  tokenTypes: StringNullMap
): Promise<CrossChainMapping> => {
  const invertPlatformMapping: { [key: string]: string } = {}
  for (const [key, value] of Object.entries(coingeckoPlatformIdMapping)) {
    if (value === null) continue
    invertPlatformMapping[value] = key
  }
  const platformPriorityDoc = await dbSettings.get('platformPriority')
  const platformPriority = asCouchDoc(asNumberMap)(platformPriorityDoc).doc

  const out: CrossChainMapping = {}

  for (const asset of coingeckoAssets) {
    let destAsset: { destChain: string; edgeTokenId: string } | undefined

    const platforms = Object.entries(asset.platforms)
    const getPriority = (k: string): number =>
      platformPriority[k] ?? Number.MAX_SAFE_INTEGER

    const sortedPlatforms = platforms.sort(
      (a, b) =>
        getPriority(invertPlatformMapping[a[0]]) -
        getPriority(invertPlatformMapping[b[0]])
    )

    for (const [platform, address] of sortedPlatforms) {
      const edgePluginId = invertPlatformMapping[platform]
      if (edgePluginId == null) continue

      const tokenType = tokenTypes[edgePluginId]
      if (tokenType == null) continue

      try {
        const tokenId = createTokenId(tokenType, asset.symbol, address)
        if (tokenId == null) continue

        if (destAsset == null) {
          destAsset = {
            destChain: edgePluginId,
            edgeTokenId: tokenId
          }
        } else {
          out[`${edgePluginId}_${tokenId}`] = {
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

  return out
}

const tokenMapping: RateEngine = async () => {
  const mapping: TokenMap = {}

  // Add the mainnet currency mapping
  for (const [key, value] of Object.entries(coingeckoMainnetCurrencyMapping)) {
    if (value === null) continue
    mapping[key] = {
      id: value,
      displayName: key
    }
  }

  const json = await fetchCoingecko(
    `${config.providers.coingeckopro.uri}/api/v3/coins/list?include_platform=true`
  )
  const tokenTypes = asCouchDoc(asStringNullMap)(
    await dbSettings.get(TOKEN_TYPES_KEY)
  )

  const data = asCoingeckoAssetResponse(json)

  const invertPlatformMapping: { [key: string]: string } = {}
  for (const [key, value] of Object.entries(platformIdMappingSyncDoc.doc)) {
    if (value === null) continue
    invertPlatformMapping[value] = key
  }

  for (const asset of data) {
    const firstPlatform: [string, string] | undefined = Object.entries(
      asset.platforms
    )[0]
    if (firstPlatform == null) continue

    const [platform, contractAddress] = firstPlatform

    const pluginId = invertPlatformMapping[platform]
    if (pluginId == null) continue

    try {
      const tokenId = createTokenId(
        tokenTypes.doc[pluginId],
        asset.symbol,
        contractAddress
      )
      if (tokenId == null) continue

      mapping[toCryptoKey({ pluginId, tokenId })] = {
        id: asset.id,
        displayName: asset.name
      }
    } catch (e) {
      // skip assets that we cannot create token id for
    }
  }

  const combinedTokenMappings: TokenMap = {
    ...automatedTokenMappingsSyncDoc.doc,
    ...mapping
  }

  await dbSettings.insert(
    wasExistingMappings({
      id: automatedTokenMappingsSyncDoc.id,
      rev: automatedTokenMappingsSyncDoc.rev,
      doc: combinedTokenMappings
    })
  )

  const crossChainDocument = await dbSettings.get('crosschain:automated')
  const crossChainDoc = asCrossChainDoc(crossChainDocument)
  const crossChainMappings = await coingeckoToCrossChainMapping(
    data,
    tokenTypes.doc
  )
  await dbSettings.insert(
    wasCrossChainDoc({
      id: crossChainDoc.id,
      rev: crossChainDoc.rev,
      doc: crossChainMappings
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
type CoinGeckoTokenInfo = ReturnType<typeof asTokenList>['tokens'][number]
const fetchCoinGeckoTokenList = async (
  platform: string
): Promise<CoinGeckoTokenInfo[]> => {
  const response = await fetchCoingecko(
    `${config.providers.coingeckopro.uri}/api/v3/token_lists/${platform}/all.json`
  )
  const tokenList = asTokenList(response)
  return tokenList.tokens
}

const updateTokenInfos = async (): Promise<void> => {
  const newTokenInfoDocs: Array<CouchDoc<EdgeTokenInfo>> = []

  const coingeckoIdsDocument = await dbSettings.get('coingecko:automated')
  const coingeckoIds = asTokenMappingsDoc(coingeckoIdsDocument).doc

  const tokenTypesDoc = await dbSettings.get(TOKEN_TYPES_KEY)
  const tokenTypes = asCouchDoc(asStringNullMap)(tokenTypesDoc).doc

  const crosschainDocument = await dbSettings.get('crosschain:automated')
  const crosschain = asCrossChainDoc(crosschainDocument).doc

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
      const tokenList = await fetchCoinGeckoTokenList(platform)
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
          rank: rank ?? Number.MAX_SAFE_INTEGER,
          currencyCode: token.symbol,
          displayName: token.name,
          multiplier: token.decimals,
          networkLocation: { contractAddress: token.address },
          chainPluginId: edgePluginId,
          tokenId: tokenId
        }

        try {
          const tokenInfoDocument = await dbTokens.get(cryptoKey)
          const tokenInfo = asTokenInfoDoc(tokenInfoDocument).doc
          if (tokenInfo.rank !== newInfo.rank) {
            newTokenInfoDocs.push(
              wasTokenInfoDoc({
                doc: newInfo,
                id: cryptoKey,
                rev: tokenInfoDocument._rev
              })
            )
          }
        } catch (e) {
          newTokenInfoDocs.push(
            wasTokenInfoDoc({
              doc: newInfo,
              id: cryptoKey
            })
          )
        }
      }
    } catch (error) {
      logger(`${edgePluginId} ${platform} tokenList failure`, error)
    }
  }

  await dbTokens.bulk({
    docs: newTokenInfoDocs
  })
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
      out[key] = value.usd
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
    },
    {
      frequency: 'hour',
      engine: updateTokenInfos
    }
  ]
}
