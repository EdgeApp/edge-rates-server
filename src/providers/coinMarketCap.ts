import { asArray, asMap, asNumber, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { AssetMap, NewRates, RateMap, ReturnRate } from './../rates'
import { coinmarketcapEdgeMap } from './../utils/currencyCodeMaps.json'
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
    coinMarketCapHistorical: { uri, apiKey }
  },
  defaultFiatCode: DEFAULT_FIAT
} = config

const DEFAULT_CODES = ['BTC', 'ETH']

export const createUniqueIdString = (
  requestedCodes: string[],
  assetMap: AssetMap
): string => {
  return requestedCodes
    .filter(code => assetMap[code] != null)
    .map(code => assetMap[code])
    .join(',')
}

export const invertCodeMapKey = (
  id: string,
  assetMap: AssetMap
): string | void => {
  for (const code of Object.keys(assetMap)) {
    if (assetMap[code] === id) return code
  }
}

const OPTIONS = {
  method: 'GET',
  headers: {
    'X-CMC_PRO_API_KEY': apiKey
  },
  json: true
}

const coinMarketCapPrice = asObject({
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
  data: asMap(coinMarketCapPrice)
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
        [`${code}_${DEFAULT_FIAT}`]: results.data[code].quotes[0].quote[
          subIso(DEFAULT_FIAT)
        ].price.toString()
      }
    }, {})

const query = async (
  date: string,
  codes: string[],
  assetMap: AssetMap
): Promise<NewRates> => {
  const rates = {}
  if (codes.length === 0) return rates
  const ids = createUniqueIdString(codes, assetMap)
  try {
    const response = await fetch(
      `${uri}/v1/cryptocurrency/quotes/historical?symbol=${ids}&time_end=${date}&count=1&skip_invalid=true&convert=${subIso(
        DEFAULT_FIAT
      )}`,
      OPTIONS
    )
    if (response.status !== 200 || response.ok === false) {
      logger(
        `coinMarketCapHistorical returned code ${response.status} for ${codes} at ${date}`
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

const coinMarketCapHistorical = async (
  rateObj: ReturnRate[],
  currentTime: string,
  assetMaps: { [provider: string]: AssetMap }
): Promise<NewRates> => {
  const rates = {}
  const assetMap = {
    ...coinmarketcapEdgeMap,
    ...assetMaps.coinMarketCapAssets
  }

  if (apiKey == null) {
    logger('No coinMarketCapHistorical API key')
    return rates
  }

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
  const providers = Object.keys(datesAndCodesWanted).map(async date =>
    query(date, datesAndCodesWanted[date], assetMap)
  )
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

const coinMarketCapAssets = async (): Promise<AssetMap> => {
  const assets: { [code: string]: string } = {}
  const response = await fetch(
    'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?limit=5000',
    OPTIONS
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

export { coinMarketCapHistorical, coinMarketCapAssets }
