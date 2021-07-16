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

/*
Setting default codes simplifies return object handling. CMC returns a slightly
different object if only one currency is requested. This ensures the response
will have at least two accepted currency codes.
*/

const {
  providers: {
    coinMarketCapHistorical: { uri: historicalUri, apiKey: historicalApiKey },
    coinMarketCapCurrent: { uri: currentUri, apiKey: currentApiKey }
  },
  defaultFiatCode: DEFAULT_FIAT
} = config

const DEFAULT_CODES = ['1', '1027'] // ['BTC', 'ETH']

/*
// CURRENT PRICE UTILS
*/

export const hasUniqueId = (code: string, assetMap: AssetMap): boolean =>
  assetMap[code] !== null

export const invertCodeMapKey = (
  id: string,
  assetMap: AssetMap
): string | void => {
  for (const code of Object.keys(assetMap)) {
    if (assetMap[code] === id) return code
  }
}

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
  results: ReturnType<typeof asCoinMarketCapCurrentResponse>,
  assetMap: AssetMap
): RateMap =>
  Object.keys(results.data).reduce((out, id) => {
    const code = invertCodeMapKey(id, assetMap)
    if (code == null) return { ...out }
    return {
      ...out,
      [`${code}_${DEFAULT_FIAT}`]: results.data[id].quote[
        subIso(DEFAULT_FIAT)
      ].price.toString()
    }
  }, {})

const currentQuery = async (
  currentTime: string,
  ids: string[],
  assetMap: AssetMap
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  if (currentApiKey == null) {
    logger('No coinMarketCapHistorical API key')
    return rates
  }

  if (ids.length > 0)
    try {
      const response = await fetch(
        `${currentUri}/v1/cryptocurrency/quotes/latest?id=${ids.join(
          ','
        )}&skip_invalid=true&convert=${subIso(DEFAULT_FIAT)}`,
        currentQueryOptions
      )
      if (response.status !== 200) {
        logger(
          `coinMarketCapCurrent returned code ${response.status} for ${ids} at ${currentTime}`
        )
        throw new Error(response.statusText)
      }
      const json = asCoinMarketCapCurrentResponse(await response.json())

      // Create return object
      rates[currentTime] = coinMarketCapCurrentRateMap(json, assetMap)
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

const coinMarketCapHistoricalPrice = asObject({
  id: asNumber,
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
  results: ReturnType<typeof asCoinMarketCapHistoricalResponse>,
  assetMap: AssetMap
): RateMap =>
  Object.keys(results.data)
    .filter(code => results.data[code].quotes.length > 0)
    .reduce((out, id) => {
      const code = invertCodeMapKey(id, assetMap)
      if (code == null) return { ...out }
      return {
        ...out,
        [`${code}_${DEFAULT_FIAT}`]: results.data[id].quotes[0].quote[
          subIso(DEFAULT_FIAT)
        ].price.toString()
      }
    }, {})

const historicalQuery = async (
  date: string,
  ids: string[],
  assetMap: AssetMap
): Promise<NewRates> => {
  const rates = {}

  if (historicalApiKey == null) {
    logger('No coinMarketCapHistorical API key')
    return rates
  }

  if (ids.length === 0) return rates
  try {
    const response = await fetch(
      `${historicalUri}/v1/cryptocurrency/quotes/historical?id=${ids.join(
        ','
      )}&time_end=${date}&count=1&skip_invalid=true&convert=${subIso(
        DEFAULT_FIAT
      )}`,
      historicalQueryOptions
    )
    if (response.status !== 200 || response.ok === false) {
      logger(
        `coinMarketCapHistorical returned code ${response.status} for ${ids} at ${date}`
      )
      throw new Error(response.statusText)
    }
    const json = asCoinMarketCapHistoricalResponse(await response.json())

    // Create return object
    rates[date] = coinMarketCapHistoricalRateMap(json, assetMap)
  } catch (e) {
    logger(`No CoinMarketCapHistorical quote: ${JSON.stringify(e)}`)
  }
  return rates
}

export const coinMarketCap = async (
  rateObj: ReturnRate[],
  currentTime: string,
  assetMap: AssetMap
): Promise<NewRates> => {
  const rates = {}

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    if (datesAndCodesWanted[pair.date] == null) {
      datesAndCodesWanted[pair.date] = DEFAULT_CODES
    }
    const fromCurrency = checkConstantCode(pair.currency_pair.split('_')[0])
    if (
      !isFiatCode(fromCurrency) &&
      !DEFAULT_CODES.includes(fromCurrency) &&
      assetMap[fromCurrency] != null
    ) {
      datesAndCodesWanted[pair.date].push(assetMap[fromCurrency])
    }
  }

  // Query
  const providers: Array<Promise<NewRates>> = []
  Object.keys(datesAndCodesWanted).forEach(date => {
    if (date === currentTime) {
      providers.push(currentQuery(date, datesAndCodesWanted[date], assetMap))
    } else {
      providers.push(historicalQuery(date, datesAndCodesWanted[date], assetMap))
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
