import { asArray, asMap, asNumber, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { AssetMap, NewRates, ReturnRate } from './../rates'
import {
  assetMapReducer,
  combineRates,
  createAssetMaps,
  createReducedRateMap,
  fromCode,
  fromCryptoToFiatCurrencyPair,
  isIsoCode,
  logger,
  memoize,
  subIso
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

export const hasUniqueId = (code: string, assetMap: AssetMap): boolean =>
  assetMap[code] != null

export const invertCodeMapKey = (id: string, assetMap: AssetMap): string =>
  Object.keys(assetMap).find(key => assetMap[key] === id) ??
  'FAKE_CODE_TO_SATISFY_TYPECHECKER'

const CURRENT_OPTIONS = {
  method: 'GET',
  headers: {
    'X-CMC_PRO_API_KEY': currentapiKey
  },
  json: true
}

const asCoinMarketCapCurrentQuotes = asMap(
  asObject({
    quote: asMap(asObject({ price: asNumber }))
  })
)

const asCoinMarketCapCurrentResponse = asObject({
  data: asCoinMarketCapCurrentQuotes
})

const coinMarketCapCurrentQuote = (
  data: ReturnType<typeof asCoinMarketCapCurrentQuotes>,
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
  const rates = { [date]: {} }

  if (currentapiKey == null) {
    logger('No coinMarketCapCurrent API key')
    return rates
  }

  // Query
  try {
    const response = await fetch(
      `${currentUri}/v1/cryptocurrency/quotes/latest?id=${
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
    const json = asCoinMarketCapCurrentResponse(await response.json())

    // Create return object
    rates[date] = coinMarketCapCurrentRateMap(json.data, assetMap)
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

const ascoinMarketCapHistoricalQuotes = asMap(
  asObject({
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
)

const asCoinMarketCapHistoricalResponse = asObject({
  data: ascoinMarketCapHistoricalQuotes
})

const coinMarketCapHistoricalQuote = (
  data: ReturnType<typeof ascoinMarketCapHistoricalQuotes>,
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
  const rates = {}
  try {
    const response = await fetch(
      `${historicalUri}/v1/cryptocurrency/quotes/historical?id=${
        ids.length > 2 ? ids : ids.concat(DEFAULT_CODES)
      }&time_end=${date}&count=1&skip_invalid=true&convert=${subIso(
        DEFAULT_FIAT
      )}`,
      HISTORICAL_OPTIONS
    )
    if (response.status !== 200 || response.ok === false) {
      logger(
        `coinMarketCapHistorical returned code ${response.status} for ${ids} at ${date}`
      )
      throw new Error(response.statusText)
    }
    const json = asCoinMarketCapHistoricalResponse(await response.json())

    // Create return object
    rates[date] = coinMarketCapHistoricalRateMap(json.data, assetMap)
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

  const assetMap = await createAssetMaps(edgeAssetMap, coinMarketCapAssets)

  if (historicalApiKey == null) {
    logger('No coinMarketCapHistorical API key')
    return rates
  }

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    const fromCurrency = fromCode(pair.currency_pair)
    if (!isIsoCode(fromCurrency) && hasUniqueId(fromCurrency, assetMap)) {
      if (datesAndCodesWanted[pair.date] == null) {
        datesAndCodesWanted[pair.date] = []
      }
      datesAndCodesWanted[pair.date].push(assetMap[fromCurrency])
    }
  }

  // Query
  const providers = Object.keys(datesAndCodesWanted).map(async date => {
    if (date === currentTime)
      return coinMarketCapCurrent(date, datesAndCodesWanted[date], assetMap)
    return coinMarketCapHistorical(date, datesAndCodesWanted[date], assetMap)
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

export const coinMarketCapAssets = memoize(async (): Promise<AssetMap> => {
  const response = await fetch(
    `${historicalUri}/v1/cryptocurrency/map?limit=5000`,
    HISTORICAL_OPTIONS
  )
  if (response.ok === false) {
    throw new Error(response.status)
  }

  return assetMapReducer(
    asCoinMarketCapAssetResponse(await response.json()).data
  )
}, 'coinMarketCap')
