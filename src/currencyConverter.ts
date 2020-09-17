import { bns } from 'biggystring'
import { asMap, asNumber } from 'cleaners'
import fetch from 'node-fetch'

import CONFIG from '../serverConfig.json'
import { ExchangeResponse } from './index'
import { fiatCurrencyCodes } from './utils'

const apiKey = CONFIG.currencyConverterApiKey

const asCurrencyConverterResponse = asMap(asMap(asNumber))

// take two currencies instead of pair
const currencyConverterFetch = async (
  currency: string,
  date: string
): Promise<string> => {
  if (apiKey !== '') {
    const pair = `${currency}_USD`
    const options = {
      method: 'GET'
    }
    const url = `https://api.currconv.com/api/v7/convert?q=${pair}&compact=ultra&date=${date}&apiKey=${apiKey}`
    try {
      const result = await fetch(url, options)
      if (result.status !== 200) {
        console.error(`currencyConvertor returned code ${result.status}`)
      }
      const jsonObj = await result.json()
      asCurrencyConverterResponse(jsonObj)
      return jsonObj[pair][date].toString()
    } catch (e) {
      console.error(
        e,
        `CurrencyConverter response is invalid ${currency} date:${date}`
      )
    }
  } else {
    console.error('Missing config CurrencyConverter')
  }
  return ''
}

const currencyConverter = async (
  currencyA: string,
  currencyB: string,
  date: string
): Promise<ExchangeResponse> => {
  if (
    fiatCurrencyCodes[currencyA] == null ||
    fiatCurrencyCodes[currencyB] == null
  ) {
    return
  }
  const normalToDate = date.substring(0, 10)
  const aToUsdRate = await currencyConverterFetch(currencyA, normalToDate)
  if (aToUsdRate === '') {
    return
  }
  if (currencyB === 'USD') {
    return {
      rate: aToUsdRate,
      needsWrite: true
    }
  }
  const bToUsdRate = await currencyConverterFetch(currencyB, normalToDate)
  if (bToUsdRate === '') {
    return
  }
  return {
    rate: bns.div(aToUsdRate, bToUsdRate, 8),
    needsWrite: true
  }
}

export { currencyConverter }
