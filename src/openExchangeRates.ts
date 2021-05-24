import { asMap, asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './config'
import { fiatCurrencyCodes } from './fiatCurrencyCodes'
import { NewRates, ReturnRate } from './rates'

const appId = config.openExchangeRatesApiKey

const asOpenExchangeRatesResponse = asObject({
  rates: asMap(asNumber)
})

const openExchangeRates = async (
  rateObj: ReturnRate[],
  log: Function,
  currentTime: string
): Promise<NewRates> => {
  const rates = {}

  if (appId == null) {
    log('No openExchangeRates appId')
    return rates
  }

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    datesAndCodesWanted[pair.data.date] = []
    const fromCurrency = pair.data.currency_pair.split('_')[0]
    const toCurrency = pair.data.currency_pair.split('_')[1]
    if (
      fiatCurrencyCodes[fromCurrency] === true &&
      datesAndCodesWanted[pair.data.date].indexOf(fromCurrency) === -1
    ) {
      datesAndCodesWanted[pair.data.date].push(fromCurrency)
    }
    if (
      fiatCurrencyCodes[toCurrency] === true &&
      datesAndCodesWanted[pair.data.date].indexOf(toCurrency) === -1
    ) {
      datesAndCodesWanted[pair.data.date].push(toCurrency)
    }
  }

  // Query
  for (const date in datesAndCodesWanted) {
    if (datesAndCodesWanted[date].length === 0) continue
    const codes = datesAndCodesWanted[date].join(',')
    const justDate = date.split('T')[0]
    try {
      const response = await fetch(
        `https://openexchangerates.org/api/historical/${justDate}.json?app_id=${appId}&base=USD&symbols=${codes}`
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
