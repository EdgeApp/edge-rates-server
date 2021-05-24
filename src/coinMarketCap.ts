import { asArray, asMap, asNumber, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './config'
import { fiatCurrencyCodes } from './fiatCurrencyCodes'
import { checkConstantCode, NewRates, ReturnRate } from './rates'

// TODO: add ID map

/* 
Setting default codes simplifies return object handling. CMC returns a slightly different
object if only one currency is requested. They ignore unrecognized codes so
this ensures the response will have at least two accepted currency codes.
*/

const DEFAULT_CODES = ['BTC', 'ETH']

const coinMarketCapPrice = asObject({
  symbol: asString,
  quotes: asArray(
    asObject({
      timestamp: asString,
      quote: asObject({
        USD: asObject({
          price: asNumber
        })
      })
    })
  )
})

const asCoinMarketCapHistoricalResponse = asObject({
  data: asMap(coinMarketCapPrice)
})

const coinMarketCapHistorical = async (
  rateObj: ReturnRate[],
  log: Function
): Promise<NewRates> => {
  const rates = {}

  if (config.coinMarketCapHistoricalApiKey == null) {
    log('No coinMarketCapHistorical API key')
    return rates
  }

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    const fromCurrency = checkConstantCode(
      pair.data.currency_pair.split('_')[0]
    )
    if (fiatCurrencyCodes[fromCurrency] == null) {
      if (datesAndCodesWanted[pair.data.date] == null) {
        datesAndCodesWanted[pair.data.date] = DEFAULT_CODES
      }
      if (!DEFAULT_CODES.includes(fromCurrency))
        datesAndCodesWanted[pair.data.date].push(fromCurrency)
    }
  }

  // Query
  const options = {
    method: 'GET',
    headers: {
      'X-CMC_PRO_API_KEY': config.coinMarketCapHistoricalApiKey
    },
    json: true
  }
  for (const date in datesAndCodesWanted) {
    try {
      const codes = datesAndCodesWanted[date].join(',')
      const response = await fetch(
        `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/historical?symbol=${codes}&time_end=${date}&count=1&skip_invalid=true`,
        options
      )
      const json = asCoinMarketCapHistoricalResponse(await response.json())
      if (response.status !== 200 || response.ok === false) {
        log(
          `coinMarketCapHistorical returned code ${response.status} for ${codes} at ${date}`
        )
        throw new Error(response.statusText)
      }

      // Create return object
      rates[date] = {}
      for (const code of Object.keys(json.data)) {
        if (json.data[code].quotes.length > 0)
          rates[date][`${code}_USD`] = json.data[
            code
          ].quotes[0].quote.USD.price.toString()
      }
    } catch (e) {
      log(`No CoinMarketCapHistorical quote: ${JSON.stringify(e)}`)
    }
  }
  return rates
}

export { coinMarketCapHistorical }
