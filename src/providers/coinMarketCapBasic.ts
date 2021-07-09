import { asMap, asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, ReturnRate } from './../rates'
import { fiatCurrencyCodes } from './../utils/currencyCodeMaps'
import { checkConstantCode, logger } from './../utils/utils'

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
  currentTime: string
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  if (config.coinMarketCapCurrentApiKey == null) {
    logger('No coinMarketCapCurrent API key')
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
      if (response.status !== 200) {
        logger(
          `coinMarketCapCurrent returned code ${response.status} for ${codes} at ${currentTime}`
        )
        throw new Error(response.statusText)
      }
      const json = asCoinMarketCapCurrentResponse(await response.json())

      // Create return object
      for (const code of Object.keys(json.data)) {
        rates[currentTime][`${code}_USD`] = json.data[
          code
        ].quote.USD.price.toString()
      }
    } catch (e) {
      logger(`No coinMarketCapCurrent quote: ${JSON.stringify(e)}`)
    }
  return rates
}

export { coinMarketCapCurrent }
