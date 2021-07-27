import { asArray, asMap, asNumber, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, RateMap, ReturnRate } from './../rates'
import {
  checkConstantCode,
  combineRates,
  fromCode,
  isFiatCode,
  logger,
  subIso
} from './../utils/utils'

// TODO: add ID map

/* 
Setting default codes simplifies return object handling. CMC returns a slightly different
object if only one currency is requested. They ignore unrecognized codes so
this ensures the response will have at least two accepted currency codes.
*/

const {
  providers: {
    coinMarketCapHistorical: { uri, apiKey }
  },
  defaultFiatCode: DEFAULT_FIAT
} = config

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
      quote: asMap(
        asObject({
          price: asNumber
        })
      )
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
        [`${code}_${DEFAULT_FIAT}`]: results.data[code].quotes[0].quote[
          subIso(DEFAULT_FIAT)
        ].price.toString()
      }
    }, {})

const query = async (date: string, codes: string[]): Promise<NewRates> => {
  const rates = {}
  if (codes.length === 0) return rates
  try {
    const response = await fetch(
      `${uri}/v1/cryptocurrency/quotes/historical?symbol=${codes}&time_end=${date}&count=1&skip_invalid=true&convert=${subIso(
        DEFAULT_FIAT
      )}`,
      OPTIONS
    )
    if (response.status !== 200 || response.ok === false) {
      logger(
        `coinMarketCapHistorical returned code ${response.status} for ${codes} at ${date}`
      )
      throw new Error(response.statusText)
    }
    const json = asCoinMarketCapHistoricalResponse(await response.json())

    // Create return object
    rates[date] = coinMarketCapHistoricalRateMap(json)
  } catch (e) {
    logger(`No CoinMarketCapHistorical quote: ${JSON.stringify(e)}`)
  }
  return rates
}

const coinMarketCapHistorical = async (
  rateObj: ReturnRate[]
): Promise<NewRates> => {
  const rates = {}

  if (apiKey == null) {
    logger('No coinMarketCapHistorical API key')
    return rates
  }

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    if (datesAndCodesWanted[pair.date] == null) {
      datesAndCodesWanted[pair.date] = [...DEFAULT_CODES]
    }
    const fromCurrency = checkConstantCode(fromCode(pair.currency_pair))
    if (!isFiatCode(fromCurrency) && !DEFAULT_CODES.includes(fromCurrency)) {
      datesAndCodesWanted[pair.date].push(fromCurrency)
    }
  }

  // Query
  const providers = Object.keys(datesAndCodesWanted).map(async date =>
    query(date, datesAndCodesWanted[date])
  )
  try {
    const response = await Promise.all(providers)
    combineRates(rates, response)
  } catch (e) {
    logger('Failed to query coinMarketCapHistorical with error', e.message)
  }

  return rates
}

export { coinMarketCapHistorical }
