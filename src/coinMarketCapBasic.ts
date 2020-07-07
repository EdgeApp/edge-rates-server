import { bns } from 'biggystring'
import { asMap, asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import CONFIG from '../serverConfig.json'
import { ExchangeResponse } from './index'

const asCoinMarketCapCurrentResponse = asObject({
  data: asMap(
    asObject({
      quote: asObject({
        USD: asObject({
          price: asNumber
        })
      })
    })
  )
})

const _fetchQuote = async (currency: string): Promise<string> => {
  if (CONFIG.coinMarketCapCurrentApiKey !== null) {
    const options = {
      method: 'GET',
      headers: {
        'X-CMC_PRO_API_KEY': CONFIG.coinMarketCapCurrentApiKey
      },
      json: true
    }
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${currency}`
    try {
      const result = await fetch(url, options)
      if (result.status !== 200) {
        console.error(`CoinMarketCapBasic returned code ${result.status}`)
      }
      const jsonObj = await result.json()
      asCoinMarketCapCurrentResponse(jsonObj)
      return jsonObj.data[currency].quote.USD.price.toString()
    } catch (e) {
      console.error(`No CoinMarketCapBasic ${currency} quote: `, e)
    }
  } else {
    console.error('Missing config coinMarketCapBasicApiKey')
  }
  return ''
}

const coinMarketCapCurrent = async (
  currencyA: string,
  currencyB: string
): Promise<ExchangeResponse> => {
  const aToUsdRate = await _fetchQuote(currencyA)
  if (aToUsdRate === '') {
    return
  }
  if (currencyB === 'USD') {
    return {
      rate: aToUsdRate,
      needsWrite: true
    }
  }
  const bToUsdRate = await _fetchQuote(currencyB)
  if (bToUsdRate === '') {
    return
  }
  return {
    rate: bns.div(aToUsdRate, bToUsdRate, 8),
    needsWrite: true
  }
}

export { coinMarketCapCurrent }
