import {
  asArray,
  asEither,
  asMaybe,
  asNull,
  asNumber,
  asObject,
  asString
} from 'cleaners'
import * as fs from 'fs'
import * as path from 'path'

import { config } from '../../../config'
import { snooze } from '../../../utils/utils'
import {
  CryptoRate,
  CryptoRateMap,
  EdgeCurrencyPluginId,
  NumberMap,
  RateEngine,
  RateProvider,
  TokenMap
} from '../../types'
import { createTokenId } from '../../utils'
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
          // eslint-disable-next-line @typescript-eslint/camelcase
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
        USD: asObject({ price: asNumber })
      })
    })
  )
})

// Mappings will eventually be saved in some database. They can be on disk for now.
const saveToDisk = (out: TokenMap): void => {
  const outputPath = path.join(__dirname, 'tokenMapping.json')
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2))
  console.log(`Token mapping saved to: ${outputPath}`)
}
const readFromDisk = (): TokenMap => {
  const outputPath = path.join(__dirname, 'tokenMapping.json')
  if (!fs.existsSync(outputPath)) {
    return {}
  }
  const json = fs.readFileSync(outputPath, 'utf8')
  return JSON.parse(json)
}
const TokenMapping = asObject(
  asObject({
    id: asString,
    slug: asString
  })
)
const coinmarketcapTokenIdMap: TokenMap =
  asMaybe(TokenMapping)(readFromDisk()) ?? {}

const tokenMapping: RateEngine = async () => {
  const out: { [key: string]: { id: string; slug: string } } = {}

  // Add the mainnet currency mapping
  for (const [key, value] of Object.entries(
    coinmarketcapMainnetCurrencyMapping
  )) {
    if (value === null) continue
    out[`${key}_null`] = {
      id: value,
      slug: key
    }
  }

  const json = await fetchCoinmarketcap(
    `${config.providers.coinMarketCapHistorical.uri}/v1/cryptocurrency/map?aux=platform`
  )

  const data = asCoinMarketCapAssetResponse(json)

  const invertPlatformMapping: { [key: string]: string } = {}
  for (const [key, value] of Object.entries(coinmarketcapPlatformIdMapping)) {
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

      out[`${pluginId}_${tokenId}`] = {
        id: asset.id.toString(),
        slug: asset.slug
      }
    } catch (e) {
      // skip assets that we cannot create token id for
    }
  }

  // Store the mapping in the global variable for potential use
  Object.assign(coinmarketcapTokenIdMap, out)

  saveToDisk(out)
  console.log(Object.keys(coinmarketcapTokenIdMap).length)
}

const getCurrentRates = async (ids: string[]): Promise<NumberMap> => {
  const json = await fetchCoinmarketcap(
    `${
      config.providers.coinMarketCapHistorical.uri
    }/v2/cryptocurrency/quotes/latest?id=${ids.join(
      ','
    )}&skip_invalid=true&convert=USD`
  )
  const data = asCoinMarketCapCurrentQuotes(json)
  const out: NumberMap = {}
  for (const [key, value] of Object.entries(data.data)) {
    out[key] = value.quote.USD.price
  }
  return out
}

const FIVE_MINUTES = 5 * 60 * 1000

const isCurrent = (isoDate: Date, nowDate: Date): boolean => {
  const requestedDate = isoDate.getTime()
  const rightNow = nowDate.getTime()
  if (requestedDate > rightNow || requestedDate + FIVE_MINUTES < rightNow) {
    return false
  }
  return true
}

export const coinmarketcap: RateProvider = {
  providerId: 'coinmarketcap',
  type: 'api',
  getCryptoRates: async ({ targetFiat, requestedRates }) => {
    if (targetFiat !== 'USD') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const ids: string[] = []
    const supportedRates: CryptoRate[] = []
    const out: CryptoRate[] = []
    const currentDate = new Date()
    for (const rate of requestedRates.values()) {
      const mapping =
        coinmarketcapTokenIdMap[`${rate.asset.pluginId}_${rate.asset.tokenId}`]
      if (isCurrent(rate.isoDate, currentDate) && mapping != null) {
        supportedRates.push(rate)
        ids.push(mapping.id)
      } else {
        out.push(rate)
      }
    }
    const currentRates = await getCurrentRates(ids)

    const outFound: CryptoRateMap = new Map()
    const outNeeded: CryptoRateMap = new Map()
    requestedRates.forEach((rate, key) => {
      const mapping =
        coinmarketcapTokenIdMap[`${rate.asset.pluginId}_${rate.asset.tokenId}`]
      if (mapping == null) {
        outNeeded.set(key, rate)
        return
      }

      const exchangeRate = currentRates[mapping.id]
      if (isCurrent(rate.isoDate, currentDate) && exchangeRate != null) {
        outFound.set(key, { ...rate, rate: exchangeRate })
      } else {
        outNeeded.set(key, rate)
      }
    })

    return {
      foundRates: outFound,
      requestedRates: outNeeded
    }
  },
  engines: [
    {
      frequency: 'day',
      engine: tokenMapping
    }
  ]
}
