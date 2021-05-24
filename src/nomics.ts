import { asArray, asObject, asOptional, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './config'
import { fiatCurrencyCodes } from './fiatCurrencyCodes'
import { checkConstantCode, NewRates, ReturnRate } from './rates'

// TODO: add ID map

const apiKey = config.nomicsApiKey

const asNomicsResponse = asArray(
  asObject({
    price: asOptional(asString),
    symbol: asString
  })
)

const nomics = async (
  requestedRates: ReturnRate[],
  log: Function,
  currentTime: string
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  if (apiKey == null) {
    log('No Nomics API key')
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
  if (codesWanted.length > 0)
    try {
      const ids = codesWanted.join(',')
      const response = await fetch(
        `https://api.nomics.com/v1/currencies/ticker?key=${apiKey}&ids=${ids}&convert=USD`
      )
      const json = asNomicsResponse(await response.json())
      if (
        response.status === 429 ||
        response.status === 401 ||
        response.ok === false
      ) {
        log(
          `nomics returned code ${response.status} for ${ids} at ${currentTime}`
        )
        throw new Error(response.statusText)
      }

      // Create return object
      for (const code of json) {
        if (code.price != null)
          rates[currentTime][`${code.symbol}_USD`] = code.price
      }
    } catch (e) {
      log(`No Nomics quote: ${JSON.stringify(e)}`)
    }
  return rates
}

export { nomics }
