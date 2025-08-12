import { asArray, asMaybe, asNumber, asObject, asString } from 'cleaners'
import { syncedDocument } from 'edge-server-tools'

import { config } from '../../../config'
import { dateOnly, snooze } from '../../../utils/utils'
import {
  asPlatformIdMapping,
  asTokenMap,
  EdgeCurrencyPluginId,
  NumberMap,
  RateBuckets,
  RateEngine,
  RateProvider,
  TokenMap,
  wasExistingMappings
} from '../../types'
import {
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
  while (true) {
    const response = await fetch(input, { headers, ...init })

    if (response.status === 429) {
      await snooze(1000)
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
      slug: key
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
  asPlatformIdMapping
)
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
  const out: { [key: string]: { id: string; slug: string } } = {}

  // Add the mainnet currency mapping
  for (const [key, value] of Object.entries(coingeckoMainnetCurrencyMapping)) {
    if (value === null) continue
    out[key] = {
      id: value,
      slug: key
    }
  }

  const json = await fetchCoingecko(
    `${config.providers.coingeckopro.uri}/api/v3/coins/list?include_platform=true`
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
        pluginId as EdgeCurrencyPluginId,
        asset.symbol,
        contractAddress
      )
      if (tokenId == null) continue

      out[toCryptoKey({ pluginId, tokenId })] = {
        id: asset.id,
        slug: asset.name
      }
    } catch (e) {
      // skip assets that we cannot create token id for
    }
  }

  const combinedTokenMappings: TokenMap = {
    ...automatedTokenMappingsSyncDoc.doc,
    ...out
  }

  await dbSettings.insert(
    wasExistingMappings({
      id: automatedTokenMappingsSyncDoc.id,
      rev: automatedTokenMappingsSyncDoc.rev,
      doc: combinedTokenMappings
    })
  )
}

const getCurrentRates = async (ids: Set<string>): Promise<NumberMap> => {
  const json = await fetchCoingecko(
    `${config.providers.coingeckopro.uri}/api/v3/simple/price?ids=${Array.from(
      ids
    ).join(',')}&vs_currencies=usd`
  )
  const data = asGeckoBulkUsdResponse(json)
  const out: NumberMap = {}
  for (const [key, value] of Object.entries(data)) {
    out[key] = value.usd
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
      ).then(json => {
        const data = asMaybe(asCoingeckoHistoricalUsdResponse)(json)
        if (data != null) {
          out[id] = data.market_data.current_price.usd
        }
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
  getCryptoRates: async ({ targetFiat, requestedRates }) => {
    if (targetFiat !== 'USD' || config.providers.coingeckopro.apiKey === '') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rightNow = new Date()
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
