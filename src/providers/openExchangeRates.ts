import { asMap, asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, ReturnRate } from './../rates'
import {
  combineRates,
  createReducedRateMap,
  dateOnly,
  fromCode,
  fromCryptoToFiatCurrencyPair,
  isIsoCode,
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

const asOpenExchangeRatesQuotes = asMap(asNumber)

const asOpenExchangeRatesResponse = asObject({
  rates: asOpenExchangeRatesQuotes
})

const openExchangeRatesQuote = (
  data: ReturnType<typeof asOpenExchangeRatesQuotes>,
  code: string
): string => (1 / data[code]).toString()

const openExchangeRatesRateMap = createReducedRateMap(
  fromCryptoToFiatCurrencyPair,
  openExchangeRatesQuote
)

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
    rates[date] = openExchangeRatesRateMap(json.rates)
  } catch (e) {
    logger(`Failed to get ${codes} from openExchangeRates`, e)
  }
  return rates
}

export const openExchangeRates = async (
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
      isIsoCode(fromCurrency) &&
      datesAndCodesWanted[pair.date].indexOf(fromCurrency) === -1
    ) {
      datesAndCodesWanted[pair.date].push(subIso(fromCurrency))
    }
    if (
      isIsoCode(toCurrency) &&
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
