import { asMap, asNumber, asObject, asOptional, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, ReturnRate } from './../rates'
import { fiatCurrencyCodes } from './../utils/currencyCodeMaps'

const { currencyConverterBaseUrl, currencyConverterApiKey } = config

const asCurrencyConverterResponse = asObject({
  status: asOptional(asNumber),
  error: asOptional(asString),
  results: asMap(asObject({ val: asMap(asNumber) }))
})

const currencyConverter = async (
  rateObj: ReturnRate[],
  log: Function,
  currentTime: string
): Promise<NewRates> => {
  const rates = {}

  if (currencyConverterApiKey == null) {
    log('No currencyConverter apiKey')
    return rates
  }

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    datesAndCodesWanted[pair.date] = []
    const fromCurrency = pair.currency_pair.split('_')[0]
    const toCurrency = pair.currency_pair.split('_')[1]
    if (
      fiatCurrencyCodes[fromCurrency] === true &&
      fromCurrency !== 'USD' &&
      datesAndCodesWanted[pair.date].indexOf(`${fromCurrency}_USD`) === -1
    ) {
      datesAndCodesWanted[pair.date].push(`${fromCurrency}_USD`)
    }
    if (
      fiatCurrencyCodes[toCurrency] === true &&
      fromCurrency !== 'USD' &&
      datesAndCodesWanted[pair.date].indexOf(`USD_${toCurrency}`) === -1
    ) {
      datesAndCodesWanted[pair.date].push(`USD_${toCurrency}`)
    }
  }

  // Query
  for (const date in datesAndCodesWanted) {
    if (datesAndCodesWanted[date].length === 0) continue
    const codes = datesAndCodesWanted[date].join(',')
    const justDate = date.split('T')[0]
    try {
      const response = await fetch(
        `${currencyConverterBaseUrl}/api/v7/convert?q=${codes}&date=${justDate}&apiKey=${currencyConverterApiKey}`
      )
      const { status, error, results } = asCurrencyConverterResponse(
        await response.json()
      )
      if (
        (status != null && status !== 200) ||
        (error != null && error !== '') ||
        response.ok === false
      ) {
        log(
          `currencyConverter returned code ${response.status} for ${codes} at ${date}`
        )
        throw new Error(
          `currencyConverter returned with status: ${JSON.stringify(
            status ?? response.status
          )} and error: ${JSON.stringify(error)}`
        )
      }

      // Create return object
      rates[date] = {}
      for (const pair of Object.keys(results)) {
        rates[date][pair] = results[pair].val[justDate].toString()
      }
    } catch (e) {
      log(`Failed to get ${codes} from currencyconverterapi.com`, e)
    }
  }
  return rates
}

export { currencyConverter }
