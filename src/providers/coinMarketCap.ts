import {
  asArray,
  asMap,
  asNumber,
  asObject,
  asOptional,
  asString
} from 'cleaners'
import fetch from 'node-fetch'

import CONFIG from '../../serverConfig.json'
import { ProviderConfig, ProviderFetch, RateParams } from '../types'
import { log } from '../utils'
import { fiatMap } from './coinMarketCapFiatMap'

const historicalConfig = CONFIG.coinMarketCapHistorical
const currentConfig = CONFIG.coinMarketCapCurrent

export const asQuote = asMap(
  asObject({ price: asNumber, timestamp: asOptional(asString) })
)

export const asCoinMarketCapCurrentResponse = asObject({
  data: asMap(asObject({ quote: asQuote }))
})

export const asCoinMarketCapHistoricalResponse = asObject({
  status: asObject({
    timestamp: asString,
    error_code: asOptional(asNumber),
    error_message: asOptional(asNumber),
    elapsed: asOptional(asNumber),
    credit_count: asOptional(asNumber)
  }),
  data: asObject({
    id: asOptional(asNumber),
    name: asOptional(asString),
    symbol: asOptional(asString),
    quotes: asArray(
      asObject({
        timestamp: asString,
        quote: asQuote
      })
    )
  })
})

export const fetchCoinMarketCap = (
  { apiKey, url }: ProviderConfig,
  asQuery: (rateParams: RateParams) => string,
  asResponse: (response: object, rateParams: RateParams) => string
): ProviderFetch => async rateParams => {
  const { currencyA: cryptoCode, currencyB: fiatCode, date } = rateParams
  if (fiatMap[fiatCode] == null || fiatMap[cryptoCode] != null) {
    return
  }
  if (apiKey !== null) {
    try {
      const queryUrl = `${url}${asQuery(rateParams)}`
      const result = await fetch(queryUrl, {
        method: 'GET',
        headers: { 'X-CMC_PRO_API_KEY': apiKey },
        json: true
      })
      const jsonObj = await result.json()

      if (result.ok === false || jsonObj.status.error_message != null) {
        throw new Error(
          `CoinMarketCap returned code ${jsonObj.status.error_message ??
            result.status}`
        )
      }

      return asResponse(jsonObj, rateParams)
    } catch (e) {
      log(
        `cryptoCode: ${cryptoCode}`,
        `fiatCode: ${fiatCode}`,
        `date: ${date}`,
        `url: ${url}`,
        'No CoinMarketCap quote',
        e
      )
    }
  } else {
    log(`Missing apiKey for ${url}`)
  }
}

export const coinMarketCapHistorical = fetchCoinMarketCap(
  historicalConfig,
  ({ currencyA, currencyB, date }) =>
    `?symbol=${currencyA}&convert=${currencyB}&time_end=${date}&count=1`,
  (response, { currencyB }) => {
    const rates = asCoinMarketCapHistoricalResponse(response)
    return rates.data.quotes[0].quote[currencyB].price.toString()
  }
)

export const coinMarketCapCurrent = fetchCoinMarketCap(
  currentConfig,
  ({ currencyA, currencyB }) => `?symbol=${currencyA}&convert=${currencyB}`,
  (response, { currencyA, currencyB }) => {
    const rates = asCoinMarketCapCurrentResponse(response)
    return rates.data[currencyA].quote[currencyB].price.toString()
  }
)
