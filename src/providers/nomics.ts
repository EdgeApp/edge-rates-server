import { asArray, asObject, asOptional, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { NewRates, ReturnRate } from '../rates'
import { fiatCurrencyCodes } from '../utils/currencyCodeMaps'
import { checkConstantCode } from './../utils/utils'

// TODO: add ID map

const { uri, apiKey } = config.providers.nomics

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
    if (request.date !== currentTime) continue
    const fromCurrency = checkConstantCode(request.currency_pair.split('_')[0])
    if (fiatCurrencyCodes[fromCurrency] == null) {
      codesWanted.push(fromCurrency)
    }
  }

  // Query
  if (codesWanted.length > 0)
    try {
      const ids = codesWanted.join(',')
      const response = await fetch(
        `${uri}/v1/currencies/ticker?key=${apiKey}&ids=${ids}&convert=USD`
      )
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
      const json = asNomicsResponse(await response.json())

      // Create return object
      json.forEach(code => {
        if (code.price != null)
          rates[currentTime][`${code.symbol}_USD`] = code.price
      })
    } catch (e) {
      log(`No Nomics quote: ${JSON.stringify(e)}`)
    }
  return rates
}

export { nomics }
