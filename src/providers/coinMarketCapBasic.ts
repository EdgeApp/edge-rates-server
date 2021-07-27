import { asMap, asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import { config } from './../config'
import { NewRates, ReturnRate } from './../rates'
import {
  checkConstantCode,
  createReducedRateMap,
  fromCode,
  fromCryptoToFiatCurrencyPair,
  isFiatCode,
  logger,
  subIso
} from './../utils/utils'

// TODO: add ID map

const {
  providers: {
    coinMarketCapCurrent: { uri, apiKey }
  },
  defaultFiatCode: DEFAULT_FIAT
} = config

const asCoinMarketCapCurrentQuotes = asMap(
  asObject({
    quote: asMap(asObject({ price: asNumber }))
  })
)

const asCoinMarketCapCurrentResponse = asObject({
  data: asCoinMarketCapCurrentQuotes
})

const coinMarketCapCurrentQuote = (
  data: ReturnType<typeof asCoinMarketCapCurrentQuotes>,
  code: string
): string => data[code].quote[subIso(DEFAULT_FIAT)].price.toString()

const coinMarketCapCurrentRateMap = createReducedRateMap(
  fromCryptoToFiatCurrencyPair,
  coinMarketCapCurrentQuote
)

const coinMarketCapCurrent = async (
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
    const fromCurrency = checkConstantCode(fromCode(request.currency_pair))
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
      rates[currentTime] = coinMarketCapCurrentRateMap(json.data)
    } catch (e) {
      logger(`No coinMarketCapCurrent quote: ${JSON.stringify(e)}`)
    }
  return rates
}

export { coinMarketCapCurrent }
