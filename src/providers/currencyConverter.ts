import { asMap, asNumber } from 'cleaners'
import fetch from 'node-fetch'

import CONFIG from '../../serverConfig.json'
import { ProviderFetch } from '../types'
import { log } from '../utils'
import { fiatMap } from './fiatCurrencyCodes'

const { url: currencyConverterUrl, apiKey } = CONFIG.currencyConverter

const asCurrencyConverterResponse = asMap(asMap(asNumber))

// take two currencies instead of pair
export const currencyConverter: ProviderFetch = async rateParams => {
  const { currencyA, currencyB, currencyPair, date } = rateParams
  if (fiatMap[currencyA] == null || fiatMap[currencyB] == null) return

  const normalToDate = date.substring(0, 10)
  if (apiKey !== '') {
    const url = `${currencyConverterUrl}?q=${currencyPair}&compact=ultra&date=${normalToDate}&apiKey=${apiKey}`
    try {
      const result = await fetch(url, {
        method: 'GET'
      })
      if (result.status !== 200) {
        log(
          `currencyPair: ${currencyPair}`,
          `date: ${normalToDate}`,
          `currencyConvertor returned code ${result.status}`
        )
      }
      const jsonObj = asCurrencyConverterResponse(await result.json())
      return jsonObj[currencyPair][normalToDate].toString()
    } catch (e) {
      log(
        `currencyPair: ${currencyPair}`,
        `date: ${normalToDate}`,
        'CurrencyConverter response is invalid',
        e
      )
    }
  } else {
    log('Missing config CurrencyConverter')
  }
}
