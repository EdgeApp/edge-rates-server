import { asMap, asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, ProviderResponse, ReturnRate } from './../rates'
import { fiatCurrencyCodes } from './../utils/currencyCodeMaps'

const { uri, apiKey } = config.providers.openExchangeRates

const asOpenExchangeRatesResponse = asObject({
  rates: asMap(asNumber)
})

const query = async (
  date: string,
  codes: string[],
  log: Function
): Promise<ProviderResponse> => {
  const rates = { [date]: {} }
  if (codes.length === 0) return rates
  const codeString = codes.join(',')
  const justDate = date.split('T')[0]
  try {
    const response = await fetch(
      `${uri}/api/historical/${justDate}.json?app_id=${apiKey}&base=USD&symbols=${codeString}`
    )
    const json = asOpenExchangeRatesResponse(await response.json()).rates
    if (response.ok === false) {
      log(
        `openExchangeRates returned code ${response.status} for ${codes} at ${date}`
      )
      throw new Error(
        `openExchangeRates returned with status: ${JSON.stringify(
          status ?? response.status
        )} and error: ${JSON.stringify(response.statusText)}`
      )
    }

    // Create return object
    Object.keys(json).forEach(code => {
      rates[date][`${code}_USD`] = (1 / json[code]).toString()
    })
  } catch (e) {
    log(`Failed to get ${codes} from openExchangeRates`, e)
  }
  return rates
}

const openExchangeRates = async (
  rateObj: ReturnRate[],
  log: Function,
  currentTime: string
): Promise<NewRates> => {
  const rates = {}

  if (apiKey == null) {
    log('No openExchangeRates appId')
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
      fiatCurrencyCodes[fromCurrency] === true &&
      datesAndCodesWanted[pair.date].indexOf(fromCurrency) === -1
    ) {
      datesAndCodesWanted[pair.date].push(fromCurrency)
    }
    if (
      fiatCurrencyCodes[toCurrency] === true &&
      datesAndCodesWanted[pair.date].indexOf(toCurrency) === -1
    ) {
      datesAndCodesWanted[pair.date].push(toCurrency)
    }
  }

  // Query
  const providers = Object.keys(datesAndCodesWanted).map(async date =>
    query(date, datesAndCodesWanted[date], log)
  )
  try {
    const response = await Promise.all(providers)
    Object.assign(
      rates,
      response.reduce((res, out) => ({ ...res, ...out }), {})
    )
  } catch (e) {
    log('Failed to query openExchangeRates with error', e.message)
  }

  return rates
}

export { openExchangeRates }
