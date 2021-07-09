import { asArray, asObject, asOptional, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { NewRates, RateMap, ReturnRate } from '../rates'
import { nomicsEdgeMap } from '../utils/currencyCodeMaps.json'
import { checkConstantCode, isFiatCode, logger, subIso } from './../utils/utils'

/*
Nomics generally uses currency codes as unique IDs and in case of conflict they
just add numbers to the end. For this reason we only need to be sure that Edge
supported currencies are mapped out and don't need to map out the rest and can
just pass currency codes.
*/

const {
  providers: {
    nomics: { uri, apiKey }
  },
  defaultFiatCode: DEFAULT_FIAT
} = config

const asNomicsResponse = asArray(
  asObject({
    price: asOptional(asString),
    symbol: asString
  })
)

const nomicsRateMap = (results: ReturnType<typeof asNomicsResponse>): RateMap =>
  results.reduce((out, code) => {
    return {
      ...out,
      [`${code.symbol}_${DEFAULT_FIAT}`]: code.price
    }
  }, {})

const overrideCode = (code: string): string => nomicsEdgeMap[code] ?? code

const nomics = async (
  requestedRates: ReturnRate[],
  currentTime: string
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  if (apiKey == null) {
    logger('No Nomics API key')
    return rates
  }

  // Gather codes
  const codesWanted: string[] = []
  for (const request of requestedRates) {
    if (request.date !== currentTime) continue
    const fromCurrency = overrideCode(
      checkConstantCode(request.currency_pair.split('_')[0])
    )
    if (!isFiatCode(fromCurrency)) {
      codesWanted.push(fromCurrency)
    }
  }

  // Query
  if (codesWanted.length > 0)
    try {
      const ids = codesWanted.join(',')
      const response = await fetch(
        `${uri}/v1/currencies/ticker?key=${apiKey}&ids=${ids}&convert=${subIso(
          DEFAULT_FIAT
        )}`
      )
      if (
        response.status === 429 ||
        response.status === 401 ||
        response.ok === false
      ) {
        logger(
          `nomics returned code ${response.status} for ${ids} at ${currentTime}`
        )
        throw new Error(response.statusText)
      }
      const json = asNomicsResponse(await response.json())

      // Create return object
      rates[currentTime] = nomicsRateMap(json)
    } catch (e) {
      logger(`No Nomics quote: ${JSON.stringify(e)}`)
    }
  return rates
}

export { nomics }
