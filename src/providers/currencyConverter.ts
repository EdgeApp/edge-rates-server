import { asMap, asNumber, asObject, asOptional, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, ReturnRate } from './../rates'
import {
  combineRates,
  createReducedRateMap,
  dateOnly,
  fromCode,
  fromFiatToFiat,
  invertPair,
  isIsoCode,
  logger,
  subIso,
  toCode,
  toIsoPair
} from './../utils/utils'

const {
  providers: {
    currencyConverter: { uri, apiKey }
  },
  defaultFiatCode: DEFAULT_FIAT
} = config

const asCurrencyConvertorQuotes = asMap(asObject({ val: asMap(asNumber) }))

const asCurrencyConverterResponse = asObject({
  status: asOptional(asNumber),
  error: asOptional(asString),
  results: asCurrencyConvertorQuotes
})

const currencyConverterPair = (pair: string): string =>
  fromFiatToFiat(fromCode(pair), toCode(pair))

const currencyConverterQuote = (
  results: ReturnType<typeof asCurrencyConvertorQuotes>,
  pair: string
): string => Object.values(results[pair].val)[0].toString()

const currencyConverterRateMap = createReducedRateMap(
  currencyConverterPair,
  currencyConverterQuote
)

const query = async (date: string, codes: string[]): Promise<NewRates> => {
  const rates = { [date]: {} }
  if (codes.length === 0) return rates
  try {
    const response = await fetch(
      `${uri}/api/v7/convert?q=${codes}&date=${dateOnly(date)}&apiKey=${apiKey}`
    )

    if (response.ok === false) {
      logger(
        `currencyConverter returned code ${response.status} for ${codes} at ${date}`
      )
      throw new Error(
        `currencyConverter returned with status: ${response.status}`
      )
    }

    const { status, error, results } = asCurrencyConverterResponse(
      await response.json()
    )
    if ((status != null && status !== 200) || (error != null && error !== '')) {
      logger(
        `currencyConverter returned code ${status} for ${codes} at ${date}`
      )
      throw new Error(
        `currencyConverter returned with status: ${status} and error: ${error}`
      )
    }

    // Create return object
    rates[date] = currencyConverterRateMap(results)
  } catch (e) {
    logger(`Failed to get ${codes} from currencyconverterapi.com`, e)
  }
  return rates
}

export const currencyConverter = async (
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
    const fromCurrency = fromCode(pair.currency_pair)
    const toCurrency = toCode(pair.currency_pair)
    const currencyConverterToDefaultPair = toIsoPair(
      subIso,
      subIso
    )(fromCurrency)
    if (
      isIsoCode(fromCurrency) &&
      fromCurrency !== DEFAULT_FIAT &&
      datesAndCodesWanted[pair.date].indexOf(currencyConverterToDefaultPair) ===
        -1
    ) {
      datesAndCodesWanted[pair.date].push(currencyConverterToDefaultPair)
    }

    const currencyConverterFromDefaultPair = toIsoPair(subIso, subIso)(
      DEFAULT_FIAT,
      toCurrency
    )
    if (
      isIsoCode(toCurrency) &&
      toCurrency !== DEFAULT_FIAT &&
      datesAndCodesWanted[pair.date].indexOf(
        invertPair(currencyConverterFromDefaultPair)
      ) === -1
    ) {
      datesAndCodesWanted[pair.date].push(
        invertPair(currencyConverterFromDefaultPair)
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
    logger('Failed to query currencyConverter with error', e)
  }

  return rates
}
