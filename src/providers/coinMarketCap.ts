import { asArray, asNumber, asObject, asOptional, asString } from 'cleaners'
import fetch from 'node-fetch'

import { asObjectMap } from '../types/cleaners'
import { ProviderConfig, ProviderFetch, RateGetterParams } from '../types/types'
import { config } from '../utils/config'
import { logger } from '../utils/utils'
import { fiatMap } from './coinMarketCapFiatMap'

export const asCoinMarketCapStatus = asObject({
  status: asObject({
    timestamp: asString,
    error_code: asNumber,
    error_message: asOptional(asString, null),
    elapsed: asNumber,
    credit_count: asNumber,
    notice: asOptional(asString, null)
  })
})

export const asLatestQuote = asObjectMap({
  price: asNumber,
  last_updated: asString
})

export const asHistoricalQuote = asObjectMap({
  price: asNumber,
  timestamp: asString
})

export const asCoinMarketCapLatestData = asObject({
  data: asObjectMap({ quote: asLatestQuote })
})

export const asCoinMarketCapHistoricalData = asObject({
  data: asObject({
    id: asNumber,
    name: asString,
    symbol: asString,
    quotes: asArray(
      asObject({
        timestamp: asString,
        quote: asHistoricalQuote
      })
    )
  })
})

export const fetchCoinMarketCap = (
  { apiKey, url }: ProviderConfig,
  asQuery: (rateParams: RateGetterParams) => string,
  asResponse: (response: object, rateParams: RateGetterParams) => string
): ProviderFetch => async rateParams => {
  const { currencyA: cryptoCode, currencyB: fiatCode } = rateParams
  if (fiatMap[fiatCode] == null || fiatMap[cryptoCode] != null) return null
  if (apiKey !== null) {
    try {
      const queryUrl = `${url}${asQuery(rateParams)}`
      const result = await fetch(queryUrl, {
        method: 'GET',
        headers: { 'X-CMC_PRO_API_KEY': apiKey },
        json: true
      })
      const jsonObj = await result.json()
      const { status } = asCoinMarketCapStatus(jsonObj)
      if (
        status.error_code !== 0 ||
        (status.error_message != null && status.error_message !== '') ||
        result.ok === false
      ) {
        throw new Error(
          `CoinMarketCap returned with status: ${JSON.stringify(status)}`
        )
      }

      return asResponse(jsonObj, rateParams)
    } catch (e) {
      logger('ERROR', `url: ${url}`, 'No CoinMarketCap quote', e, rateParams)
    }
  } else {
    logger(`Missing apiKey for ${url}`, rateParams)
  }
  return null
}

export const coinMarketCapLatest = fetchCoinMarketCap(
  config.coinMarketCapLatest,
  ({ currencyA, currencyB }) => `?symbol=${currencyA}&convert=${currencyB}`,
  (response, { currencyA, currencyB }) => {
    const { data } = asCoinMarketCapLatestData(response)
    return data[currencyA].quote[currencyB].price.toString()
  }
)

export const coinMarketCapHistorical = fetchCoinMarketCap(
  config.coinMarketCapHistorical,
  ({ currencyA, currencyB, date }) =>
    `?symbol=${currencyA}&convert=${currencyB}&time_end=${date}&count=1`,
  (response, { currencyB }) => {
    const { data } = asCoinMarketCapHistoricalData(response)
    return data.quotes[0].quote[currencyB].price.toString()
  }
)
