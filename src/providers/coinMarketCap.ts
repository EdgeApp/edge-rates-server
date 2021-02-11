import { bns } from 'biggystring'
import fetch from 'node-fetch'

import CONFIG from '../../serverConfig.json'
import { ProviderFetch } from '../rates'
import { log, validateObject } from '../utils'
import { coinMarketCapFiatMap } from './coinMarketCapFiatMap'

export const CmcHistoricalQuote = {
  type: 'object',
  properties: {
    data: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        symbol: { type: 'string' },
        quotes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              quote: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    price: { type: 'number' },
                    timestamp: { type: 'string' }
                  },
                  required: ['price', 'timestamp']
                }
              }
            },
            required: ['quote']
          }
        }
      },
      required: ['id', 'name', 'symbol', 'quotes']
    },
    status: {
      type: 'object',
      properties: {
        timestamp: { type: 'string' },
        error_code: { type: 'number' },
        elapsed: { type: 'number' },
        credit_count: { type: 'number' }
      },
      required: ['timestamp']
    }
  },
  required: ['data', 'status']
}

const _fetchQuote = async (
  cryptoCode: string,
  fiatCode: string,
  date: string
): Promise<string | void> => {
  if (CONFIG.coinMarketCapHistoricalApiKey !== null) {
    const options = {
      method: 'GET',
      headers: {
        'X-CMC_PRO_API_KEY': CONFIG.coinMarketCapHistoricalApiKey
      },
      json: true
    }
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/historical?symbol=${cryptoCode}&time_end=${date}&count=1&convert=${fiatCode}`
    try {
      const result = await fetch(url, options)
      if (result.status !== 200) {
        log(
          `cryptoCode: ${cryptoCode}`,
          `fiatCode: ${fiatCode}`,
          `date: ${date}`,
          `CoinMarketCapHistorical returned code ${result.status}`
        )
        return
      }
      const jsonObj = await result.json()
      const valid = validateObject(jsonObj, CmcHistoricalQuote)
      if (valid) {
        return jsonObj.data.quotes[0].quote[fiatCode].price.toString()
      } else {
        log(
          `cryptoCode: ${cryptoCode}`,
          `fiatCode: ${fiatCode}`,
          `date: ${date}`,
          'CoinMarketCap response is invalid',
          jsonObj
        )
      }
    } catch (e) {
      log(
        `cryptoCode: ${cryptoCode}`,
        `fiatCode: ${fiatCode}`,
        `date: ${date}`,
        'No CoinMarketCap quote',
        e
      )
    }
  } else {
    log('Missing config coinMarketCapApiKey')
  }
}

const coinMarketCapHistorical: ProviderFetch = async (
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
    const response = await _fetchQuote(currencyA, currencyB, date)
    if (response != null) rate = response
  } else if (
    coinMarketCapFiatMap[currencyA] != null &&
    coinMarketCapFiatMap[currencyB] == null
  ) {
    // Invert pair and returned rate if fiat is the numerator
    const response = await _fetchQuote(currencyB, currencyA, date)
    if (response != null) rate = bns.div('1', response, 8, 10)
  }
  // Return null if both codes are fiat, both codes are crypto, or queries fail
  return rate
}

export { coinMarketCapHistorical }
