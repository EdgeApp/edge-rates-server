import { asArray, asObject, asOptional, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { NewRates, RateMap, ReturnRate } from './../rates'

const { uri } = config.providers.compound

const fixCurrency = (currencyCode: string): string => {
  return currencyCode.toUpperCase()
}

const asCompoundResponse = asObject({
  cToken: asArray(
    asObject({
      symbol: asString,
      exchange_rate: asObject({ value: asString }),
      underlying_symbol: asString
    })
  ),
  error: asOptional(asString)
})

const compoundRateMap = (
  response: ReturnType<typeof asCompoundResponse>
): RateMap =>
  response.cToken.reduce((out, code) => {
    const {
      symbol,
      underlying_symbol: underlyingSymbol,
      exchange_rate: { value }
    } = code
    return {
      ...out,
      [`${fixCurrency(symbol)}_${fixCurrency(underlyingSymbol)}`]: value
    }
  }, {})

const compound = async (
  rateObj: ReturnRate[],
  log: Function,
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

    rates[currentTime] = compoundRateMap(json)
  } catch (e) {
    log(`No Compound quote: ${JSON.stringify(e)}`)
  }
  return rates
}

export { compound }
