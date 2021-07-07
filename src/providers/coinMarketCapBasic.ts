import { asMap, asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, RateMap, ReturnRate } from './../rates'
import { checkConstantCode, isFiatCode, logger, subIso } from './../utils/utils'

// TODO: add ID map

const {
  providers: {
    coinMarketCapCurrent: { uri, apiKey }
  },
  defaultFiatCode: DEFAULT_FIAT
} = config

const asCoinMarketCapCurrentResponse = asObject({
  data: asMap(
    asObject({
      quote: asMap(asObject({ price: asNumber }))
    })
  )
})

const coinMarketCapRateMap = (
  results: ReturnType<typeof asCoinMarketCapCurrentResponse>
): RateMap =>
  Object.keys(results.data).reduce((out, code) => {
    return {
      ...out,
      [`${code}_${DEFAULT_FIAT}`]: results.data[code].quote[
        subIso(DEFAULT_FIAT)
      ].price.toString()
    }
  }, {})

export const coinMarketCapCurrent = async (
  requestedRates: ReturnRate[],
  currentTime: string
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  if (apiKey == null) {
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
      'X-CMC_PRO_API_KEY': apiKey
    },
    json: true
  }
  if (codesWanted.length > 0)
    try {
      const codes = codesWanted.join(',')
      const response = await fetch(
        `${uri}/v1/cryptocurrency/quotes/latest?symbol=${codes}&skip_invalid=true&convert=${subIso(
          DEFAULT_FIAT
        )}`,
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
      rates[currentTime] = coinMarketCapRateMap(json)
    } catch (e) {
      logger(`No coinMarketCapCurrent quote: ${JSON.stringify(e)}`)
    }
  return rates
}
