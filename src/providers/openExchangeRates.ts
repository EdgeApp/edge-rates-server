import { asMap, asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, RateMap, ReturnRate } from './../rates'
import {
  combineRates,
  dateOnly,
  fromCode,
  isFiatCode,
  logger,
  subIso,
  toCode
} from './../utils/utils'

const {
  providers: {
    openExchangeRates: { uri, apiKey }
  },
  defaultFiatCode: DEFAULT_FIAT
} = config

const asOpenExchangeRatesResponse = asObject({
  rates: asMap(asNumber)
})

const openExchangeRatesRateMap = (
  results: ReturnType<typeof asOpenExchangeRatesResponse>
): RateMap =>
  Object.keys(results.rates).reduce((out, code) => {
    return {
      ...out,
      [`${code}_${DEFAULT_FIAT}`]: (1 / results.rates[code]).toString()
    }
  }, {})

const query = async (date: string, codes: string[]): Promise<NewRates> => {
  const rates = { [date]: {} }
  if (codes.length === 0) return rates
  const codeString = codes.join(',')
  try {
    const response = await fetch(
      `${uri}/api/historical/${dateOnly(
        date
      )}.json?app_id=${apiKey}&base=${subIso(
        DEFAULT_FIAT
      )}&symbols=${codeString}`
    )
    const json = asOpenExchangeRatesResponse(await response.json())
    if (response.ok === false) {
      logger(
        `openExchangeRates returned code ${response.status} for ${codes} at ${date}`
      )
      throw new Error(
        `openExchangeRates returned with status: ${JSON.stringify(
          status ?? response.status
        )} and error: ${JSON.stringify(response.statusText)}`
      )
    }

    // Create return object
    rates[date] = openExchangeRatesRateMap(json)
  } catch (e) {
    logger(`Failed to get ${codes} from openExchangeRates`, e)
  }
  return rates
}

const openExchangeRates = async (
  rateObj: ReturnRate[],
  currentTime: string
): Promise<NewRates> => {
  const rates = {}

  if (apiKey == null) {
    logger('No openExchangeRates appId')
    return rates
  }

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    if (datesAndCodesWanted[pair.date] == null)
      datesAndCodesWanted[pair.date] = []
    const fromCurrency = fromCode(pair.currency_pair)
    const toCurrency = toCode(pair.currency_pair)
    if (
      isFiatCode(fromCurrency) &&
      datesAndCodesWanted[pair.date].indexOf(fromCurrency) === -1
    ) {
      datesAndCodesWanted[pair.date].push(subIso(fromCurrency))
    }
    if (
      isFiatCode(toCurrency) &&
      datesAndCodesWanted[pair.date].indexOf(toCurrency) === -1
    ) {
      datesAndCodesWanted[pair.date].push(subIso(toCurrency))
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
    logger('Failed to query openExchangeRates with error', e.message)
  }

  return rates
}

export { openExchangeRates }
