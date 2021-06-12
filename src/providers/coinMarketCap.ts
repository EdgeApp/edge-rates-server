import { asArray, asMap, asNumber, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, ReturnRate } from './../rates'
import { fiatCurrencyCodes } from './../utils/currencyCodeMaps'
import { checkConstantCode } from './../utils/utils'

// TODO: add ID map

/* 
Setting default codes simplifies return object handling. CMC returns a slightly different
object if only one currency is requested. They ignore unrecognized codes so
this ensures the response will have at least two accepted currency codes.
*/

const { coinMarketCapBaseUrl, coinMarketCapHistoricalApiKey } = config

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

  if (coinMarketCapHistoricalApiKey == null) {
    log('No coinMarketCapHistorical API key')
    return rates
  }

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    if (datesAndCodesWanted[pair.date] == null) {
      datesAndCodesWanted[pair.date] = DEFAULT_CODES
    }
    const fromCurrency = checkConstantCode(pair.currency_pair.split('_')[0])
    if (
      fiatCurrencyCodes[fromCurrency] == null &&
      !DEFAULT_CODES.includes(fromCurrency)
    ) {
      datesAndCodesWanted[pair.date].push(fromCurrency)
    }
  }

  // Query
  const options = {
    method: 'GET',
    headers: {
      'X-CMC_PRO_API_KEY': coinMarketCapHistoricalApiKey
    },
    json: true
  }
  for (const date in datesAndCodesWanted) {
    try {
      const codes = datesAndCodesWanted[date].join(',')
      const response = await fetch(
        `${coinMarketCapBaseUrl}/v1/cryptocurrency/quotes/historical?symbol=${codes}&time_end=${date}&count=1&skip_invalid=true`,
        options
      )
      if (response.status !== 200 || response.ok === false) {
        log(
          `coinMarketCapHistorical returned code ${response.status} for ${codes} at ${date}`
        )
        throw new Error(response.statusText)
      }
      const json = asCoinMarketCapHistoricalResponse(await response.json())

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
