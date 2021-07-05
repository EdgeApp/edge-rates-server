import { asMap, asNumber, asObject, asOptional, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, RateMap, ReturnRate } from './../rates'
import {
  addIso,
  combineRates,
  isFiatCode,
  logger,
  subIso
} from './../utils/utils'

const {
  providers: {
    currencyConverter: { uri, apiKey }
  },
  defaultFiatCode: DEFAULT_FIAT
} = config

const asCurrencyConvertorResults = asMap(asObject({ val: asMap(asNumber) }))

const asCurrencyConverterResponse = asObject({
  status: asOptional(asNumber),
  error: asOptional(asString),
  results: asCurrencyConvertorResults
})

const currencyConverterRateMap = (
  results: ReturnType<typeof asCurrencyConvertorResults>
): RateMap =>
  Object.keys(results).reduce((out, pair) => {
    const codes = pair.split('_')
    return {
      ...out,
      [`${addIso(codes[0])}_${addIso(codes[1])}`]: Object.values(
        results[pair].val
      )[0].toString()
    }
  }, {})

const query = async (date: string, codes: string[]): Promise<NewRates> => {
  const rates = { [date]: {} }
  if (codes.length === 0) return rates
  const justDate = date.split('T')[0]
  try {
    const response = await fetch(
      `${uri}/api/v7/convert?q=${codes}&date=${justDate}&apiKey=${apiKey}`
    )
    const { status, error, results } = asCurrencyConverterResponse(
      await response.json()
    )
    if (
      (status != null && status !== 200) ||
      (error != null && error !== '') ||
      response.ok === false
    ) {
      logger(
        `currencyConverter returned code ${response.status} for ${codes} at ${date}`
      )
      throw new Error(
        `currencyConverter returned with status: ${JSON.stringify(
          status ?? response.status
        )} and error: ${JSON.stringify(error)}`
      )
    }

    // Create return object
    rates[date] = currencyConverterRateMap(results)
  } catch (e) {
    logger(`Failed to get ${codes} from currencyconverterapi.com`, e)
  }
  return rates
}

const currencyConverter = async (
  rateObj: ReturnRate[],
  currentTime: string
): Promise<NewRates> => {
  const rates = {}

  if (apiKey == null) {
    logger('No currencyConverter apiKey')
    return rates
  }

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    if (datesAndCodesWanted[pair.date] == null)
      datesAndCodesWanted[pair.date] = []
    const fromCurrency = pair.currency_pair.split('_')[0]
    const toCurrency = pair.currency_pair.split('_')[1]
    if (
      isFiatCode(fromCurrency) &&
      fromCurrency !== DEFAULT_FIAT &&
      datesAndCodesWanted[pair.date].indexOf(
        `${subIso(fromCurrency)}_${subIso(DEFAULT_FIAT)}`
      ) === -1
    ) {
      datesAndCodesWanted[pair.date].push(
        `${subIso(fromCurrency)}_${subIso(DEFAULT_FIAT)}`
      )
    }
    if (
      isFiatCode(toCurrency) &&
      fromCurrency !== DEFAULT_FIAT &&
      datesAndCodesWanted[pair.date].indexOf(
        `${subIso(DEFAULT_FIAT)}_${subIso(toCurrency)}`
      ) === -1
    ) {
      datesAndCodesWanted[pair.date].push(
        `${subIso(DEFAULT_FIAT)}_${subIso(toCurrency)}`
      )
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
    logger('Failed to query currencyConverter with error', e.message)
  }

  return rates
}

export { currencyConverter }
