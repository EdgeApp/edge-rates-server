import { asMap, asNumber, asObject, asOptional, asString } from 'cleaners'
import fetch from 'node-fetch'

import { ProviderFetch } from '../types/types'
import { config } from '../utils/config'
import { logger } from '../utils/utils'
import { fiatMap } from './fiatCurrencyCodes'

const { url: currencyConverterUrl, apiKey } = config.currencyConverter

export const asCurrencyConverterResponse = asObject({
  status: asOptional(asNumber),
  error: asOptional(asString),
  ...asMap(asNumber)
})

export const currencyConverter: ProviderFetch = async rateParams => {
  const { currencyA, currencyB, currencyPair, date } = rateParams
  if (fiatMap[currencyA] == null || fiatMap[currencyB] == null) return null

  const normalToDate = date.substring(0, 10)
  if (apiKey !== '') {
    const url = `${currencyConverterUrl}?q=${currencyPair}&date=${normalToDate}&compact=ultra&apiKey=${apiKey}`
    try {
      const result = await fetch(url, { method: 'GET' })
      const { status, error, ...rates } = asCurrencyConverterResponse(
        await result.json()
      )

      if (
        (status != null && status !== 200) ||
        (error != null && error !== '') ||
        result.ok === false
      ) {
        throw new Error(
          `CurrencyConvertor returned with status: ${JSON.stringify(
            status ?? result.status
          )} and error: ${JSON.stringify(error)}`
        )
      }
      if (rates[currencyPair]?.[normalToDate] != null) {
        return rates[currencyPair][normalToDate].toString()
      }
    } catch (e) {
      logger(
        'ERROR',
        `url: ${url.split('&apiKey=')[0]}`,
        'No CurrencyConverter quote',
        e,
        rateParams
      )
    }
  } else {
    logger(`Missing apiKey for ${currencyConverterUrl}`, rateParams)
  }
  return null
}
