import { asMap, asNumber } from 'cleaners'
import fetch from 'node-fetch'

import CONFIG from '../serverConfig.json'
import { fiatCurrencyCodes } from './fiatCurrencyCodes'

const apiKey = CONFIG.currencyConverterApiKey

const asCurrencyConverterResponse = asMap(asMap(asNumber))

// take two currencies instead of pair
const currencyConverterFetch = async (
  pair: string,
  date: string,
  log: Function
): Promise<string | void> => {
  if (apiKey !== '') {
    const options = {
      method: 'GET'
    }
    const url = `https://api.currconv.com/api/v7/convert?q=${pair}&compact=ultra&date=${date}&apiKey=${apiKey}`
    try {
      const result = await fetch(url, options)
      if (result.status !== 200) {
        log(`currencyConvertor returned code ${result.status}`)
      }
      const jsonObj = await result.json()
      asCurrencyConverterResponse(jsonObj)
      return jsonObj[pair][date].toString()
    } catch (e) {
      log(`CurrencyConverter response is invalid ${JSON.stringify(e)}`)
    }
  } else {
    log('Missing config CurrencyConverter')
  }
}

const currencyConverter = async (
  currencyA: string,
  currencyB: string,
  date: string,
  log: Function
): Promise<string> => {
  let rate = ''
  if (
    fiatCurrencyCodes[currencyA] != null &&
    fiatCurrencyCodes[currencyB] != null
  ) {
    const normalToDate = date.substring(0, 10)
    const response = await currencyConverterFetch(
      `${currencyA}_${currencyB}`,
      normalToDate,
      log
    )
    if (response != null) rate = response
  }
  return rate
}

export { currencyConverter }
