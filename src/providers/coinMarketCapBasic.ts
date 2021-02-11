import { bns } from 'biggystring'
import { asMap, asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import CONFIG from '../../serverConfig.json'
import { ProviderFetch } from '../rates'
import { log } from '../utils'
import { coinMarketCapFiatMap } from './coinMarketCapFiatMap'

const asCoinMarketCapCurrentResponse = asObject({
  data: asMap(
    asObject({
      quote: asMap(asObject({ price: asNumber }))
    })
  )
})

const _fetchQuote = async (
  cryptoCode: string,
  fiatCode: string
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
        log(
          `cryptoCode: ${cryptoCode}`,
          `fiatCode: ${fiatCode}`,
          `CoinMarketCapBasic returned code ${result.status}`
        )
      }
      const jsonObj = await result.json()
      asCoinMarketCapCurrentResponse(jsonObj)
      return jsonObj.data[cryptoCode].quote[fiatCode].price.toString()
    } catch (e) {
      log(
        `cryptoCode: ${cryptoCode}`,
        `fiatCode: ${fiatCode}`,
        'No CoinMarketCapBasic quote',
        e
      )
    }
  } else {
    log('Missing config coinMarketCapBasicApiKey')
  }
}

const coinMarketCapCurrent: ProviderFetch = async (
  currencyA,
  currencyB,
  date
) => {
  let rate = ''
  if (
    coinMarketCapFiatMap[currencyB] != null &&
    coinMarketCapFiatMap[currencyA] == null
  ) {
    // Query coinmarketcap if fiat is denominator
    const response = await _fetchQuote(currencyA, currencyB)
    if (response != null) rate = response
  } else if (
    coinMarketCapFiatMap[currencyA] != null &&
    coinMarketCapFiatMap[currencyB] == null
  ) {
    // Invert pair and returned rate if fiat is the numerator
    const response = await _fetchQuote(currencyB, currencyA)
    if (response != null) rate = bns.div('1', response, 8, 10)
  }
  // Return null if both codes are fiat, both codes are crypto, or queries fail
  return rate
}

export { coinMarketCapCurrent }
