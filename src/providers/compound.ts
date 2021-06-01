import { asArray, asObject, asOptional, asString } from 'cleaners'
import fetch from 'node-fetch'

import { NewRates, ReturnRate } from './../rates'

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

const compound = async (
  rateObj: ReturnRate[],
  log: Function,
  currentTime: string
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  // Query
  try {
    const response = await fetch('https://api.compound.finance/api/v2/ctoken')
    if (response.status !== 200 || response.ok === false)
      throw new Error(
        `Compound returned with status: ${JSON.stringify(
          response.status
        )} and error: ${JSON.stringify(response)}`
      )
    const json = asCompoundResponse(await response.json())
    if (json.error != null) throw new Error(json.error)

    // Create return object
    json.cToken.forEach(code => {
      rates[currentTime][
        `${fixCurrency(code.symbol)}_${fixCurrency(code.underlying_symbol)}`
      ] = code.exchange_rate.value
    })
  } catch (e) {
    log(`No Compound quote: ${JSON.stringify(e)}`)
  }
  return rates
}

export { compound }
