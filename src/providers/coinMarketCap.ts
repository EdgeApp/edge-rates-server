import { asArray, asMap, asNumber, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, ReturnRate } from './../rates'
import {
  AssetMap,
  coinmarketcapDefaultMap,
  coinmarketcapEdgeMap,
  fiatCurrencyCodes
} from './../utils/currencyCodeMaps'
import { checkConstantCode, logger } from './../utils/utils'

/*
Setting default codes simplifies return object handling. CMC returns a slightly
different object if only one currency is requested. This ensures the response
will have at least two accepted currency codes.
*/

const DEFAULT_CODES = ['BTC', 'ETH']

const OPTIONS = {
  method: 'GET',
  headers: {
    'X-CMC_PRO_API_KEY': config.coinMarketCapHistoricalApiKey
  },
  json: true
}

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

const coinMarketCapPrice = asObject({
  id: asNumber,
  symbol: asString,
  quotes: asArray(
    asObject({
      timestamp: asString,
      quote: asObject({
        USD: asObject({
          price: asNumber
        })
      })
    })
  )
})

const asCoinMarketCapHistoricalResponse = asObject({
  data: asMap(coinMarketCapPrice)
})

const coinMarketCapHistorical = async (
  rateObj: ReturnRate[],
  currentTime: string,
  assetMaps: { [provider: string]: AssetMap }
): Promise<NewRates> => {
  const rates = {}
  const assetMap = {
    ...coinmarketcapDefaultMap,
    ...coinmarketcapEdgeMap,
    ...assetMaps.coinMarketCapAssets
  }

  if (config.coinMarketCapHistoricalApiKey == null) {
    logger('No coinMarketCapHistorical API key')
    return rates
  }

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    const fromCurrency = checkConstantCode(pair.currency_pair.split('_')[0])
    if (fiatCurrencyCodes[fromCurrency] == null) {
      if (datesAndCodesWanted[pair.date] == null) {
        datesAndCodesWanted[pair.date] = DEFAULT_CODES
      }
      if (!DEFAULT_CODES.includes(fromCurrency))
        datesAndCodesWanted[pair.date].push(fromCurrency)
    }
  }

  // Query
  for (const date in datesAndCodesWanted) {
    try {
      const codes = createUniqueIdString(datesAndCodesWanted[date], assetMap)
      const response = await fetch(
        `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/historical?id=${codes}&time_end=${date}&count=1&skip_invalid=true`,
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
      rates[date] = {}
      for (const id of Object.keys(json.data)) {
        const code = invertCodeMapKey(json.data[id].id.toString(), assetMap)
        if (code != null && json.data[id].quotes.length > 0)
          rates[date][`${code}_USD`] = json.data[
            id
          ].quotes[0].quote.USD.price.toString()
      }
    } catch (e) {
      logger(`No CoinMarketCapHistorical quote: ${JSON.stringify(e)}`)
    }
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
