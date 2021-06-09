import { asMap, asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, ReturnRate } from './../rates'
import { fiatCurrencyCodes } from './../utils/currencyCodeMaps'

const { openExchangeRatesBaseUrl, openExchangeRatesApiKey } = config

const asOpenExchangeRatesResponse = asObject({
  rates: asMap(asNumber)
})

const openExchangeRates = async (
  rateObj: ReturnRate[],
  log: Function,
  currentTime: string
): Promise<NewRates> => {
  const rates = {}

  if (openExchangeRatesApiKey == null) {
    log('No openExchangeRates appId')
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
  for (const date in datesAndCodesWanted) {
    if (datesAndCodesWanted[date].length === 0) continue
    const codes = datesAndCodesWanted[date].join(',')
    const justDate = date.split('T')[0]
    try {
      const response = await fetch(
        `${openExchangeRatesBaseUrl}/api/historical/${justDate}.json?app_id=${openExchangeRatesApiKey}&base=USD&symbols=${codes}`
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
      rates[date] = {}
      for (const code of Object.keys(json)) {
        rates[date][`${code}_USD`] = (1 / json[code]).toString()
      }
    } catch (e) {
      log(`Failed to get ${codes} from openExchangeRates`, e)
    }
  }
  return rates
}

export { openExchangeRates }
