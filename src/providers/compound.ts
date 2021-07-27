import { asArray, asObject, asOptional, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { NewRates, ReturnRate } from './../rates'
import {
  createReducedRateMapArray,
  logger,
  toCurrencyPair
} from './../utils/utils'

const { uri } = config.providers.compound

const fixCurrency = (currencyCode: string): string => {
  return currencyCode.toUpperCase()
}

const asCompoundQuote = asObject({
  symbol: asString,
  exchange_rate: asObject({ value: asString }),
  underlying_symbol: asString
})

const asCompoundResponse = asObject({
  cToken: asArray(asCompoundQuote),
  error: asOptional(asString)
})

const compoundPair = (code: ReturnType<typeof asCompoundQuote>): string =>
  toCurrencyPair(fixCurrency(code.symbol), fixCurrency(code.underlying_symbol))

const compoundQuote = (code: ReturnType<typeof asCompoundQuote>): string =>
  code.exchange_rate.value

const compoundRateMap = createReducedRateMapArray(compoundPair, compoundQuote)

const compound = async (
  rateObj: ReturnRate[],
  currentTime: string
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  // Query
  try {
    const response = await fetch(`${uri}/api/v2/ctoken`)
    if (response.status !== 200 || response.ok === false)
      throw new Error(
        `Compound returned with status: ${JSON.stringify(
          response.status
        )} and error: ${JSON.stringify(response)}`
      )
    const json = asCompoundResponse(await response.json())
    if (json.error != null) throw new Error(json.error)

    rates[currentTime] = compoundRateMap(json.cToken)
  } catch (e) {
    logger(`No Compound quote: ${JSON.stringify(e)}`)
  }
  return rates
}

export { compound }
