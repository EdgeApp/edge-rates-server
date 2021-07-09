import { asMap, asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, ReturnRate } from './../rates'
import {
  coinmarketcapDefaultMap,
  coinmarketcapEdgeMap
} from './../utils/currencyCodeMaps'
import { checkConstantCode, isFiatCode, logger } from './../utils/utils'

const CODE_MAP = { ...coinmarketcapDefaultMap, ...coinmarketcapEdgeMap }

const createUniqueIdString = (requestedCodes: string[]): string => {
  return requestedCodes
    .filter(code => CODE_MAP[code] != null)
    .map(code => CODE_MAP[code])
    .join(',')
}

const invertCodeMapKey = (id: number): string | void => {
  for (const code of Object.keys(CODE_MAP)) {
    if (CODE_MAP[code] === id) return code
  }
}

const asCoinMarketCapCurrentResponse = asObject({
  data: asMap(
    asObject({
      id: asNumber,
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
    if (!isFiatCode(fromCurrency)) {
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
      const codes = createUniqueIdString(codesWanted)
      const response = await fetch(
        `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=${codes}`,
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
      for (const id of Object.keys(json.data)) {
        const code = invertCodeMapKey(json.data[id].id)
        if (code != null)
          rates[currentTime][`${code}_iso:USD`] = json.data[
            id
          ].quote.USD.price.toString()
      }
    } catch (e) {
      logger(`No coinMarketCapCurrent quote: ${JSON.stringify(e)}`)
    }
  return rates
}

export { coinMarketCapCurrent }
