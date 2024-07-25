import {
  asArray,
  asMap,
  asNumber,
  asObject,
  asString,
  asUnknown
} from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { AssetMap, NewRates, ReturnRate } from './../rates'
import {
  assetMapReducer,
  combineRates,
  createReducedRateMap,
  daysBetween,
  fromCode,
  fromCryptoToFiatCurrencyPair,
  hasUniqueId,
  invertCodeMapKey,
  isIsoCode,
  logger,
  snooze,
  subIso,
  withinLastFiveMinutes
} from './../utils/utils'

/*
Setting default codes simplifies return object handling. CMC returns a slightly
different object if only one currency is requested. This ensures the response
will have at least two accepted currency codes.
*/

const DEFAULT_CODES = ['1', '1027'] // ['BTC', 'ETH']

const {
  providers: {
    coinMarketCapHistorical: { uri: historicalUri, apiKey: historicalApiKey },
    coinMarketCapCurrent: { uri: currentUri, apiKey: currentapiKey }
  },
  defaultFiatCode: DEFAULT_FIAT
} = config

const CURRENT_OPTIONS = {
  method: 'GET',
  headers: {
    'X-CMC_PRO_API_KEY': currentapiKey
  },
  json: true
}

const asCoinMarketCapCurrentQuotes = asObject({
  quote: asMap(asObject({ price: asNumber }))
})

const asCoinMarketCapCurrentResponse = asObject({
  data: asObject(asUnknown)
})

const coinMarketCapCurrentQuote = (
  data: { [id: string]: ReturnType<typeof asCoinMarketCapCurrentQuotes> },
  id: string
): string => data[id].quote[subIso(DEFAULT_FIAT)].price.toString()

const coinMarketCapCurrentRateMap = createReducedRateMap(
  fromCryptoToFiatCurrencyPair,
  coinMarketCapCurrentQuote,
  invertCodeMapKey
)

export const coinMarketCapCurrent = async (
  date: string,
  ids: string[],
  assetMap: AssetMap
): Promise<NewRates> => {
  const rates: NewRates = { [date]: {} }
  if (ids.length === 0) return rates

  if (currentapiKey == null) {
    logger('No coinMarketCapCurrent API key')
    return rates
  }

  // Query
  try {
    const response = await fetch(
      `${currentUri}/v2/cryptocurrency/quotes/latest?id=${
        ids.length > 2 ? ids : ids.concat(DEFAULT_CODES)
      }&skip_invalid=true&convert=${subIso(DEFAULT_FIAT)}`,
      CURRENT_OPTIONS
    )
    if (response.status !== 200) {
      logger(
        `coinMarketCapCurrent returned code ${response.status} for ${ids} at ${date}`
      )
      throw new Error(response.statusText)
    }
    const rawJson = asCoinMarketCapCurrentResponse(await response.json())

    const cleanJson: {
      [id: string]: ReturnType<typeof asCoinMarketCapCurrentQuotes>
    } = {}
    for (const rawRate of Object.keys(rawJson.data)) {
      try {
        const cleanRate = asCoinMarketCapCurrentQuotes(rawJson.data[rawRate])
        cleanJson[rawRate] = cleanRate
      } catch (e) {
        logger(`Failed to clean coinMarketCapCurrent quote for ${rawRate}:`, e)
      }
    }

    // Create return object
    rates[date] = coinMarketCapCurrentRateMap(cleanJson, assetMap)
  } catch (e) {
    logger('No coinMarketCapCurrent quote:', e)
  }
  return rates
}

const HISTORICAL_OPTIONS = {
  method: 'GET',
  headers: {
    'X-CMC_PRO_API_KEY': historicalApiKey
  },
  json: true
}

const ascoinMarketCapHistoricalQuotes = asObject({
  symbol: asString,
  quotes: asArray(
    asObject({
      timestamp: asString,
      quote: asMap(
        asObject({
          price: asNumber
        })
      )
    })
  )
})

const asCoinMarketCapHistoricalResponse = asObject({
  data: asObject(asUnknown)
})

const coinMarketCapHistoricalQuote = (
  data: { [code: string]: ReturnType<typeof ascoinMarketCapHistoricalQuotes> },
  code: string
): string => data[code].quotes?.[0].quote[subIso(DEFAULT_FIAT)].price.toString()

const coinMarketCapHistoricalRateMap = createReducedRateMap(
  fromCryptoToFiatCurrencyPair,
  coinMarketCapHistoricalQuote,
  invertCodeMapKey
)

const coinMarketCapHistorical = async (
  date: string,
  ids: string[],
  assetMap: AssetMap
): Promise<NewRates> => {
  let dailyAverage = false
  const now = new Date()
  const days = daysBetween(new Date(date), now)

  // If we're querying a date more than 3 months in the past, use
  // daily average
  if (days > 90) dailyAverage = true

  const rates = { [date]: {} }
  if (ids.length === 0) return rates

  try {
    let url = `${historicalUri}/v2/cryptocurrency/quotes/historical?id=${
      ids.length > 2 ? ids : ids.concat(DEFAULT_CODES)
    }&time_start=${date}&count=1&interval=5m&skip_invalid=true&convert=${subIso(
      DEFAULT_FIAT
    )}`
    if (dailyAverage) url += `&interval=daily`
    const response = await fetch(url, HISTORICAL_OPTIONS)
    if (response.status !== 200 || response.ok === false) {
      logger(
        `coinMarketCapHistorical returned code ${response.status} for ${ids} at ${date}`
      )
      throw new Error(response.statusText)
    }

    const rawJson = asCoinMarketCapHistoricalResponse(await response.json())

    const cleanJson: {
      [id: string]: ReturnType<typeof ascoinMarketCapHistoricalQuotes>
    } = {}
    for (const rawRate of Object.keys(rawJson.data)) {
      try {
        const cleanRate = ascoinMarketCapHistoricalQuotes(rawJson.data[rawRate])
        cleanJson[rawRate] = cleanRate
      } catch (e) {
        logger(
          `Failed to clean coinMarketCapHistorical quote for ${rawRate}:`,
          e
        )
      }
    }

    // Create return object
    rates[date] = coinMarketCapHistoricalRateMap(cleanJson, assetMap)
  } catch (e) {
    logger('No CoinMarketCapHistorical quote:', e)
  }
  return rates
}

export const coinMarketCap = async (
  rateObj: ReturnRate[],
  currentTime: string,
  edgeAssetMap: AssetMap
): Promise<NewRates> => {
  const rates = {}

  if (historicalApiKey == null) {
    logger('No coinMarketCapHistorical API key')
    return rates
  }

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    const fromCurrency = fromCode(pair.currency_pair)
    if (!isIsoCode(fromCurrency) && hasUniqueId(fromCurrency, edgeAssetMap)) {
      if (datesAndCodesWanted[pair.date] == null) {
        datesAndCodesWanted[pair.date] = []
      }
      datesAndCodesWanted[pair.date].push(edgeAssetMap[fromCurrency])
    }
  }

  // Query
  const providers = Object.keys(datesAndCodesWanted).map(async date => {
    if (withinLastFiveMinutes(date))
      return coinMarketCapCurrent(date, datesAndCodesWanted[date], edgeAssetMap)
    return coinMarketCapHistorical(
      date,
      datesAndCodesWanted[date],
      edgeAssetMap
    )
  })
  try {
    const response = await Promise.all(providers)
    combineRates(rates, response)
  } catch (e) {
    logger('Failed to query coinMarketCapHistorical with error', e)
  }

  return rates
}

const asCoinMarketCapAssetResponse = asObject({
  data: asArray(asObject({ id: asNumber, symbol: asString }))
})

export const coinMarketCapAssets = async (): Promise<AssetMap> => {
  while (true) {
    const response = await fetch(
      `${historicalUri}/v1/cryptocurrency/map?limit=5000`,
      HISTORICAL_OPTIONS
    )
    if (response.status === 429) {
      await snooze(1000) // rate limits reset every minute
      continue // retry
    }
    if (response.ok === false) {
      const text = await response.text()
      throw new Error(text)
    }

    return assetMapReducer(
      asCoinMarketCapAssetResponse(await response.json()).data
    )
  }
}
