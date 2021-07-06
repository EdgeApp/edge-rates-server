import { asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { NewRates, ReturnRate } from './../rates'
import { logger } from './../utils/utils'

const asWazirxResponse = asObject({ btcinr: asObject({ last: asString }) })

const wazirx = async (
  requestedRates: ReturnRate[],
  currentTime: string
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  // Query
  try {
    const response = await fetch('https://api.wazirx.com/api/v2/tickers')
    if (response.status !== 200) {
      throw new Error(response.statusText)
    }
    rates[currentTime][`BTC_iso:INR`] = asWazirxResponse(
      await response.json()
    ).btcinr.last
  } catch (e) {
    logger(`No wazirx quote: ${e.message}`)
  }
  return rates
}

export { wazirx }
