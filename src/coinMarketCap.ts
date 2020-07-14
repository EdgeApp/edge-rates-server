import { bns } from 'biggystring'
import fetch from 'node-fetch'

import CONFIG from '../serverConfig.json'
import { ExchangeResponse } from './index'
import { validateObject } from './utils'

const CmcHistoricalQuote = {
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

const _fetchQuote = async (currency: string, date: string): Promise<string> => {
  if (CONFIG.coinMarketCapHistoricalApiKey !== null) {
    const options = {
      method: 'GET',
      headers: {
        'X-CMC_PRO_API_KEY': CONFIG.coinMarketCapHistoricalApiKey
      },
      json: true
    }
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/historical?symbol=${currency}&time_end=${date}&count=1`
    try {
      const result = await fetch(url, options)
      if (result.status !== 200) {
        console.error(`CoinMarketCapHistorical returned code ${result.status}`)
        if (result.status === 429) {
          const keyInfo = await fetch(
            `https://pro-api.coinmarketcap.com/v1/key/info?CMC_PRO_API_KEY=${CONFIG.coinMarketCapHistoricalApiKey}`,
            options
          )
          console.log(`CoinMarketCap keyInfo ${JSON.stringify(keyInfo)}`)
        }
        return ''
      }
      const jsonObj = await result.json()
      const valid = validateObject(jsonObj, CmcHistoricalQuote)
      if (valid) {
        return jsonObj.data.quotes[0].quote.USD.price.toString()
      } else {
        console.error(
          `CoinMarketCap response is invalid ${currency} date:${date} ${JSON.stringify(
            jsonObj
          )}`
        )
      }
    } catch (e) {
      console.error(`No CoinMarketCap ${currency} date:${date} quote: `, e)
    }
  } else {
    console.error('Missing config coinMarketCapApiKey')
  }
  return ''
}

const coinMarketCapHistorical = async (
  currencyA: string,
  currencyB: string,
  date: string
): Promise<ExchangeResponse> => {
  const aToUsdRate = await _fetchQuote(currencyA, date)
  if (aToUsdRate === '') {
    return
  }
  if (currencyB === 'USD') {
    return {
      rate: aToUsdRate,
      needsWrite: true
    }
  }
  const bToUsdRate = await _fetchQuote(currencyB, date)
  if (bToUsdRate === '') {
    return
  }
  return {
    rate: bns.div(aToUsdRate, bToUsdRate, 8),
    needsWrite: true
  }
}

export { coinMarketCapHistorical }
