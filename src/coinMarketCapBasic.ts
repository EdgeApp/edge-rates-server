import { asMap, asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './config'
import { fiatCurrencyCodes } from './fiatCurrencyCodes'
import { checkConstantCode, NewRates, ReturnRate } from './rates'

// TODO: add ID map

const asCoinMarketCapCurrentResponse = asObject({
  data: asMap(
    asObject({
      quote: asMap(asObject({ price: asNumber }))
    })
  )
})

const coinMarketCapCurrent = async (
  requestedRates: ReturnRate[],
  log: Function,
  currentTime: string
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  if (config.coinMarketCapCurrentApiKey == null) {
    log('No coinMarketCapCurrent API key')
    return rates
  }

  // Gather codes
  const codesWanted: string[] = []
  for (const request of requestedRates) {
    if (request.data.date !== currentTime) continue
    const fromCurrency = checkConstantCode(
      request.data.currency_pair.split('_')[0]
    )
    if (fiatCurrencyCodes[fromCurrency] == null) {
      codesWanted.push(fromCurrency)
    }
  }

  // Query
  const options = {
    method: 'GET',
    headers: {
      'X-CMC_PRO_API_KEY': config.coinMarketCapCurrentApiKey
    },
    json: true
  }
  if (codesWanted.length > 0)
    try {
      const codes = codesWanted.join(',')
      const response = await fetch(
        `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${codes}&skip_invalid=true`,
        options
      )
      const json = asCoinMarketCapCurrentResponse(await response.json())
      if (response.status !== 200) {
        log(
          `coinMarketCapCurrent returned code ${response.status} for ${codes} at ${currentTime}`
        )
        throw new Error(response.statusText)
      }

      // Create return object
      for (const code of Object.keys(json.data)) {
        rates[currentTime][`${code}_USD`] = json.data[
          code
        ].quote.USD.price.toString()
      }
    } catch (e) {
      log(`No coinMarketCapCurrent quote: ${JSON.stringify(e)}`)
    }
  return rates
}

export { coinMarketCapCurrent }
