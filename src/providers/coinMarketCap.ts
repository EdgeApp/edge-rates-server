import { asArray, asMap, asNumber, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, RateMap, ReturnRate } from './../rates'
import { fiatCurrencyCodes } from './../utils/currencyCodeMaps'
import { checkConstantCode, combineRates } from './../utils/utils'

// TODO: add ID map

/* 
Setting default codes simplifies return object handling. CMC returns a slightly different
object if only one currency is requested. They ignore unrecognized codes so
this ensures the response will have at least two accepted currency codes.
*/

const { uri, apiKey } = config.providers.coinMarketCapHistorical

const DEFAULT_CODES = ['BTC', 'ETH']

const OPTIONS = {
  method: 'GET',
  headers: {
    'X-CMC_PRO_API_KEY': apiKey
  },
  json: true
}

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

const coinMarketCapHistoricalRateMap = (
  results: ReturnType<typeof asCoinMarketCapHistoricalResponse>
): RateMap =>
  Object.keys(results.data)
    .filter(code => results.data[code].quotes.length > 0)
    .reduce((out, code) => {
      return {
        ...out,
        [`${code}_USD`]: results.data[code].quotes[0].quote.USD.price.toString()
      }
    }, {})

const query = async (
  date: string,
  codes: string[],
  log: Function
): Promise<NewRates> => {
  const rates = {}
  if (codes.length === 0) return rates
  try {
    const response = await fetch(
      `${uri}/v1/cryptocurrency/quotes/historical?symbol=${codes}&time_end=${date}&count=1&skip_invalid=true`,
      OPTIONS
    )
    if (response.status !== 200 || response.ok === false) {
      log(
        `coinMarketCapHistorical returned code ${response.status} for ${codes} at ${date}`
      )
      throw new Error(response.statusText)
    }
    const json = asCoinMarketCapHistoricalResponse(await response.json())

    // Create return object
    rates[date] = coinMarketCapHistoricalRateMap(json)
  } catch (e) {
    log(`No CoinMarketCapHistorical quote: ${JSON.stringify(e)}`)
  }
  return rates
}

const coinMarketCapHistorical = async (
  rateObj: ReturnRate[],
  log: Function
): Promise<NewRates> => {
  const rates = {}

  if (apiKey == null) {
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
  const providers = Object.keys(datesAndCodesWanted).map(async date =>
    query(date, datesAndCodesWanted[date], log)
  )
  try {
    const response = await Promise.all(providers)
    combineRates(rates, response)
  } catch (e) {
    log('Failed to query coinMarketCapHistorical with error', e.message)
  }

  return rates
}

export { coinMarketCapHistorical }
