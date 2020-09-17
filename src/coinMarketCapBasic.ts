import { bns } from 'biggystring'
import { asMap, asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import CONFIG from '../serverConfig.json'
import { ExchangeResponse } from './index'
import { coinMarketCapFiatMap } from './utils'

const asCoinMarketCapCurrentResponse = asObject({
  data: asMap(
    asObject({
      quote: asMap(asObject({ price: asNumber }))
    })
  )
})

const _fetchQuote = async (
  cryptoCode: string,
  fiatCode: string,
  log: Function
): Promise<string | void> => {
  if (CONFIG.coinMarketCapCurrentApiKey !== null) {
    const options = {
      method: 'GET',
      headers: {
        'X-CMC_PRO_API_KEY': CONFIG.coinMarketCapCurrentApiKey
      },
      json: true
    }
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${cryptoCode}&convert=${fiatCode}`
    try {
      const result = await fetch(url, options)
      if (result.status !== 200) {
        log(`CoinMarketCapBasic returned code ${result.status}`)
      }
      const jsonObj = await result.json()
      asCoinMarketCapCurrentResponse(jsonObj)
      return jsonObj.data[cryptoCode].quote[fiatCode].price.toString()
    } catch (e) {
      log(`No CoinMarketCapBasic quote: ${JSON.stringify(e)}`)
    }
  } else {
    log('Missing config coinMarketCapBasicApiKey')
  }
}

const coinMarketCapCurrent = async (
  currencyA: string,
  currencyB: string,
  log: Function
): Promise<ExchangeResponse> => {
  // Check if both codes are fiat
  if (
    coinMarketCapFiatMap[currencyA] == null &&
    coinMarketCapFiatMap[currencyB] == null
  ) {
    return
  }
  // Check if both codes are crypto
  if (
    coinMarketCapFiatMap[currencyA] != null &&
    coinMarketCapFiatMap[currencyB] != null
  ) {
    return
  }
  // Query coinmarketcap if fiat is denominator
  let rate
  if (coinMarketCapFiatMap[currencyB] != null) {
    rate = await _fetchQuote(currencyA, currencyB, log)
  } else {
    // Invert pair and rate if fiat is the numerator
    rate = bns.div('1', await _fetchQuote(currencyB, currencyA, log), 8, 10)
  }
  if (rate == null) return
  return {
    rate,
    needsWrite: true
  }
}

export { coinMarketCapCurrent }
