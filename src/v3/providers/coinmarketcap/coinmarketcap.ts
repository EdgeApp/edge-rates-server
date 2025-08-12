import {
  asArray,
  asEither,
  asNull,
  asNumber,
  asObject,
  asString
} from 'cleaners'
import { syncedDocument } from 'edge-server-tools'

import { config } from '../../../config'
import { daysBetween, snooze } from '../../../utils/utils'
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
  coinmarketcapMainnetCurrencyMapping,
  coinmarketcapPlatformIdMapping
} from './defaultPluginIdMapping'

const fetchCoinmarketcap = async (
  input: RequestInfo,
  init: RequestInit = {}
): Promise<unknown> => {
  const headers = {
    'X-CMC_PRO_API_KEY': config.providers.coinMarketCapHistorical.apiKey
  }
  while (true) {
    const response = await fetch(input, { headers, ...init })
    if (!response.ok) {
      const message = await response.text()

      if (message.includes(`"error_code": 1008`)) {
        await snooze(1000) // rate limits reset every minute
        continue // retry
      }

      throw new Error(`Coinmarketcap failed to fetch: ${message}`)
    }

    const json = await response.json()
    return json
  }
}

const asCoinMarketCapAssetResponse = asObject({
  data: asArray(
    asObject({
      id: asNumber, // 1839,
      // "rank": 3,
      // "name": "Binance Coin",
      symbol: asString, // "BNB",
      slug: asString, // "binance-coin",
      // "is_active": 1,
      // "first_historical_data": "2017-07-25T04:30:05.000Z",
      // "last_historical_data": "2020-05-05T20:44:02.000Z",
      platform: asEither(
        asNull,
        asObject({
          id: asNumber, // 1027,
          // "name": "Ethereum",
          // "symbol": "ETH",
          slug: asString, // "ethereum",
          token_address: asString // "0xB8c77482e45F1F44dE1745F52C74426C631bDD52"
        })
      )
    })
  )
})

const asCoinMarketCapCurrentQuotes = asObject({
  data: asObject(
    asObject({
      quote: asObject({
        USD: asObject({ price: asEither(asNumber, asNull) })
      })
    })
  )
})

// still has that caveat where one rate changes the return object
const asCoinMarketCapHistoricalQuotes = asObject({
  data: asObject(
    asObject({
      quotes: asArray(
        asObject({
          timestamp: asString,
          quote: asObject(
            asObject({
              price: asNumber
            })
          )
        })
      )
    })
  )
})

const createDefaultTokenMappings = (): TokenMap => {
  const out: TokenMap = {}

  // Add the mainnet currency mapping
  for (const [key, value] of Object.entries(
    coinmarketcapMainnetCurrencyMapping
  )) {
    if (value === null) continue
    out[key] = {
      id: value,
      slug: key
    }
  }
  return out
}

let coinmarketcapTokenIdMap = createDefaultTokenMappings()

const userTokenMappingsSyncDoc = syncedDocument('coinmarketcap', asTokenMap)
const automatedTokenMappingsSyncDoc = syncedDocument(
  'coinmarketcap:automated',
  asTokenMap
)
const platformIdMappingSyncDoc = syncedDocument(
  'coinmarketcap:platforms',
  asPlatformIdMapping
)
userTokenMappingsSyncDoc.onChange(userMappings => {
  coinmarketcapTokenIdMap = {
    ...automatedTokenMappingsSyncDoc.doc,
    ...userMappings
  }
})
automatedTokenMappingsSyncDoc.onChange(autoMappings => {
  coinmarketcapTokenIdMap = {
    ...autoMappings,
    ...userTokenMappingsSyncDoc.doc
  }
})

const tokenMapping: RateEngine = async () => {
  const out: { [key: string]: { id: string; slug: string } } = {}

  // Add the mainnet currency mapping
  for (const [key, value] of Object.entries(
    coinmarketcapMainnetCurrencyMapping
  )) {
    if (value === null) continue
    out[key] = {
      id: value,
      slug: key
    }
  }

  const json = await fetchCoinmarketcap(
    `${config.providers.coinMarketCapHistorical.uri}/v1/cryptocurrency/map?aux=platform`
  )

  const data = asCoinMarketCapAssetResponse(json)

  const invertPlatformMapping: { [key: string]: string } = {}
  for (const [key, value] of Object.entries(platformIdMappingSyncDoc.doc)) {
    if (value === null) continue
    invertPlatformMapping[value] = key
  }

  for (const asset of data.data) {
    if (asset.platform == null) continue
    const pluginId = invertPlatformMapping[asset.platform.id]
    if (pluginId == null) continue

    try {
      const tokenId = createTokenId(
        pluginId as EdgeCurrencyPluginId,
        asset.symbol,
        asset.platform.token_address
      )
      if (tokenId == null) continue

      out[toCryptoKey({ pluginId, tokenId })] = {
        id: asset.id.toString(),
        slug: asset.slug
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
  const json = await fetchCoinmarketcap(
    `${
      config.providers.coinMarketCapHistorical.uri
    }/v2/cryptocurrency/quotes/latest?id=${Array.from(ids).join(
      ','
    )}&skip_invalid=true&convert=USD`
  )
  const data = asCoinMarketCapCurrentQuotes(json)
  const out: NumberMap = {}
  for (const [key, value] of Object.entries(data.data)) {
    if (value.quote.USD.price != null) {
      out[key] = value.quote.USD.price
    }
  }
  return out
}
const getHistoricalRates = async (
  ids: Set<string>,
  date: string
): Promise<NumberMap> => {
  const now = new Date()
  const days = daysBetween(new Date(date), now)

  // If we're querying a date more than 3 months in the past, use
  // daily average
  const interval = days > 90 ? 'daily' : '5m'

  // Coinmarketcap returns a slightly different format for requests
  // with just a single id. We add two ids to avoid sending duplicates.
  if (ids.size === 1) {
    ids.add('1') // bitcoin
    ids.add('1027') // ethereum
  }

  const json = await fetchCoinmarketcap(
    `${
      config.providers.coinMarketCapHistorical.uri
    }/v2/cryptocurrency/quotes/historical?id=${Array.from(ids).join(
      ','
    )}&time_start=${date}&count=1&interval=${interval}&skip_invalid=true&convert=USD`
  )

  const data = asCoinMarketCapHistoricalQuotes(json)
  const out: NumberMap = {}
  for (const [key, value] of Object.entries(data.data)) {
    out[key] = value.quotes[0].quote.USD.price
  }
  return out
}

export const coinmarketcap: RateProvider = {
  providerId: 'coinmarketcap',
  type: 'api',
  documents: [
    {
      name: 'rates_settings',
      templates: {
        coinmarketcap: createDefaultTokenMappings(),
        'coinmarketcap:automated': createDefaultTokenMappings(),
        'coinmarketcap:platforms': coinmarketcapPlatformIdMapping
      },
      syncedDocuments: [
        userTokenMappingsSyncDoc,
        automatedTokenMappingsSyncDoc,
        platformIdMappingSyncDoc
      ]
    }
  ],
  getCryptoRates: async ({ targetFiat, requestedRates }) => {
    if (targetFiat !== 'USD') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rightNow = new Date()
    const rateBuckets = reduceRequestedCryptoRates(
      requestedRates,
      rightNow,
      coinmarketcapTokenIdMap
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
      coinmarketcapTokenIdMap
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
