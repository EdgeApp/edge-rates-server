import { asArray, asMap, asNumber, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { AssetMap, NewRates, ReturnRate } from './../rates'
import {
  assetMapReducer,
  checkConstantCode,
  combineRates,
  createReducedRateMap,
  fromCode,
  fromCryptoToFiatCurrencyPair,
  isFiatCode,
  logger,
  subIso
} from './../utils/utils'

// TODO: add ID map

/* 
Setting default codes simplifies return object handling. CMC returns a slightly different
object if only one currency is requested. They ignore unrecognized codes so
this ensures the response will have at least two accepted currency codes.
*/

const DEFAULT_CODES = ['BTC', 'ETH']

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
  code: string
): string => data[code].quote[subIso(DEFAULT_FIAT)].price.toString()

const coinMarketCapCurrentRateMap = createReducedRateMap(
  fromCryptoToFiatCurrencyPair,
  coinMarketCapCurrentQuote
)

export const coinMarketCapCurrent = async (
  date: string,
  codes: string[]
): Promise<NewRates> => {
  const rates = { [date]: {} }

  if (currentapiKey == null) {
    logger('No coinMarketCapCurrent API key')
    return rates
  }

  // Query
  if (codes.length > 0)
    try {
      const response = await fetch(
        `${currentUri}/v1/cryptocurrency/quotes/latest?symbol=${codes.join(
          ','
        )}&skip_invalid=true&convert=${subIso(DEFAULT_FIAT)}`,
        CURRENT_OPTIONS
      )
      if (response.status !== 200) {
        logger(
          `coinMarketCapCurrent returned code ${response.status} for ${codes} at ${date}`
        )
        throw new Error(response.statusText)
      }
      const json = asCoinMarketCapCurrentResponse(await response.json())

      // Create return object
      rates[date] = coinMarketCapCurrentRateMap(json.data)
    } catch (e) {
      logger(`No coinMarketCapCurrent quote: ${JSON.stringify(e)}`)
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
): string => data[code].quotes[0].quote[subIso(DEFAULT_FIAT)].price.toString()

const coinMarketCapHistoricalRateMap = createReducedRateMap(
  fromCryptoToFiatCurrencyPair,
  coinMarketCapHistoricalQuote
)

const coinMarketCapHistorical = async (
  date: string,
  codes: string[]
): Promise<NewRates> => {
  const rates = {}
  if (codes.length === 0) return rates
  try {
    const response = await fetch(
      `${historicalUri}/v1/cryptocurrency/quotes/historical?symbol=${codes.join(
        ','
      )}&time_end=${date}&count=1&skip_invalid=true&convert=${subIso(
        DEFAULT_FIAT
      )}`,
      HISTORICAL_OPTIONS
    )
    if (response.status !== 200 || response.ok === false) {
      logger(
        `coinMarketCapHistorical returned code ${response.status} for ${codes} at ${date}`
      )
      throw new Error(response.statusText)
    }
    const json = asCoinMarketCapHistoricalResponse(await response.json())

    // Create return object
    rates[date] = coinMarketCapHistoricalRateMap(json.data)
  } catch (e) {
    logger(`No CoinMarketCapHistorical quote: ${JSON.stringify(e)}`)
  }
  return rates
}

export const coinMarketCap = async (
  rateObj: ReturnRate[],
  currentTime: string
): Promise<NewRates> => {
  const rates = {}

  if (historicalApiKey == null) {
    logger('No coinMarketCapHistorical API key')
    return rates
  }

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    if (datesAndCodesWanted[pair.date] == null) {
      datesAndCodesWanted[pair.date] = [...DEFAULT_CODES]
    }
    const fromCurrency = checkConstantCode(fromCode(pair.currency_pair))
    if (!isFiatCode(fromCurrency) && !DEFAULT_CODES.includes(fromCurrency)) {
      datesAndCodesWanted[pair.date].push(fromCurrency)
    }
  }

  // Query
  const providers = Object.keys(datesAndCodesWanted).map(async date => {
    if (date === currentTime)
      return coinMarketCapCurrent(date, datesAndCodesWanted[date])
    return coinMarketCapHistorical(date, datesAndCodesWanted[date])
  })
  try {
    const response = await Promise.all(providers)
    combineRates(rates, response)
  } catch (e) {
    logger('Failed to query coinMarketCapHistorical with error', e.message)
  }

  return rates
}

const asCoinMarketCapAssetResponse = asObject({
  data: asArray(asObject({ id: asNumber, symbol: asString }))
})

export const coinMarketCapAssets = async (): Promise<AssetMap> => {
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
}
