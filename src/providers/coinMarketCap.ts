import { asArray, asMap, asNumber, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { AssetMap, NewRates, RateMap, ReturnRate } from './../rates'
import {
  checkConstantCode,
  combineRates,
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

const {
  providers: {
    coinMarketCapHistorical: { uri: historicalUri, apiKey: historicalApiKey },
    coinMarketCapCurrent: { uri: currentUri, apiKey: currentApiKey }
  },
  defaultFiatCode: DEFAULT_FIAT
} = config

/*
// CURRENT PRICE UTILS
*/

const currentQueryOptions = {
  method: 'GET',
  headers: {
    'X-CMC_PRO_API_KEY': currentApiKey
  },
  json: true
}

const asCoinMarketCapCurrentResponse = asObject({
  data: asMap(
    asObject({
      quote: asMap(asObject({ price: asNumber }))
    })
  )
})

const coinMarketCapCurrentRateMap = (
  results: ReturnType<typeof asCoinMarketCapCurrentResponse>
): RateMap =>
  Object.keys(results.data).reduce((out, code) => {
    return {
      ...out,
      [`${code}_${DEFAULT_FIAT}`]: results.data[code].quote[
        subIso(DEFAULT_FIAT)
      ].price.toString()
    }
  }, {})

const currentQuery = async (
  currentTime: string,
  codesWanted: string[]
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  if (currentApiKey == null) {
    logger('No coinMarketCapHistorical API key')
    return rates
  }

  if (codesWanted.length > 0)
    try {
      const codes = codesWanted.join(',')
      const response = await fetch(
        `${currentUri}/v1/cryptocurrency/quotes/latest?symbol=${codes}&skip_invalid=true&convert=${subIso(
          DEFAULT_FIAT
        )}`,
        currentQueryOptions
      )
      if (response.status !== 200) {
        logger(
          `coinMarketCapCurrent returned code ${response.status} for ${codes} at ${currentTime}`
        )
        throw new Error(response.statusText)
      }
      const json = asCoinMarketCapCurrentResponse(await response.json())

      // Create return object
      rates[currentTime] = coinMarketCapCurrentRateMap(json)
    } catch (e) {
      logger(`No coinMarketCapCurrent quote: ${JSON.stringify(e)}`)
    }
  return rates
}

/*
// HISTORICAL PRICE UTILS
*/

const historicalQueryOptions = {
  method: 'GET',
  headers: {
    'X-CMC_PRO_API_KEY': historicalApiKey
  },
  json: true
}

const DEFAULT_CODES = ['BTC', 'ETH']

const coinMarketCapHistoricalPrice = asObject({
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
  data: asMap(coinMarketCapHistoricalPrice)
})

const coinMarketCapHistoricalRateMap = (
  results: ReturnType<typeof asCoinMarketCapHistoricalResponse>
): RateMap =>
  Object.keys(results.data)
    .filter(code => results.data[code].quotes.length > 0)
    .reduce((out, code) => {
      return {
        ...out,
        [`${code}_${DEFAULT_FIAT}`]: results.data[code].quotes[0].quote[
          subIso(DEFAULT_FIAT)
        ].price.toString()
      }
    }, {})

const historicalQuery = async (
  date: string,
  codes: string[]
): Promise<NewRates> => {
  const rates = {}

  if (historicalApiKey == null) {
    logger('No coinMarketCapHistorical API key')
    return rates
  }

  if (codes.length === 0) return rates
  try {
    const response = await fetch(
      `${historicalUri}/v1/cryptocurrency/quotes/historical?symbol=${codes}&time_end=${date}&count=1&skip_invalid=true&convert=${subIso(
        DEFAULT_FIAT
      )}`,
      historicalQueryOptions
    )
    if (response.status !== 200 || response.ok === false) {
      logger(
        `coinMarketCapHistorical returned code ${response.status} for ${codes} at ${date}`
      )
      throw new Error(response.statusText)
    }
    const json = asCoinMarketCapHistoricalResponse(await response.json())

    // Create return object
    rates[date] = coinMarketCapHistoricalRateMap(json)
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

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    if (datesAndCodesWanted[pair.date] == null) {
      datesAndCodesWanted[pair.date] = DEFAULT_CODES
    }
    const fromCurrency = checkConstantCode(pair.currency_pair.split('_')[0])
    if (!isFiatCode(fromCurrency) && !DEFAULT_CODES.includes(fromCurrency)) {
      datesAndCodesWanted[pair.date].push(fromCurrency)
    }
  }

  // Query
  const providers: Array<Promise<NewRates>> = []
  Object.keys(datesAndCodesWanted).forEach(date => {
    if (date === currentTime) {
      providers.push(currentQuery(date, datesAndCodesWanted[date]))
    } else {
      providers.push(historicalQuery(date, datesAndCodesWanted[date]))
    }
  })

  try {
    const response = await Promise.all(providers)
    combineRates(rates, response)
  } catch (e) {
    logger('Failed to query coinMarketCap with error', e.message)
  }

  return rates
}

const asCoinMarketCapAssetResponse = asObject({
  data: asArray(asObject({ id: asNumber, symbol: asString }))
})

export const coinMarketCapAssets = async (): Promise<AssetMap> => {
  const assets: { [code: string]: string } = {}
  const response = await fetch(
    'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?limit=5000',
    historicalQueryOptions
  )
  if (response.ok === false) {
    throw new Error(response.status)
  }
  const json = asCoinMarketCapAssetResponse(await response.json()).data

  for (const obj of json) {
    if (assets[obj.symbol] == null) assets[obj.symbol] = obj.id.toString()
  }

  return assets
}
