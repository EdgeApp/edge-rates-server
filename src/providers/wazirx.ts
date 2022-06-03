import { asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { NewRates, RateMap, ReturnRate } from './../rates'
import { logger } from './../utils/utils'

const { uri } = config.providers.wazirx

const asWazirxResponse = asObject({ btcinr: asObject({ last: asString }) })

const wazirxRateMap = (
  results: ReturnType<typeof asWazirxResponse>
): RateMap => ({ 'BTC_iso:INR': results.btcinr.last })

const wazirx = async (
  requestedRates: ReturnRate[],
  currentTime: string
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  // This is a BTC-only provider so we can check to exit early
  if (requestedRates.find(req => req.currency_pair === 'BTC_iso:INR') == null)
    return rates

  // Query
  try {
    const response = await fetch(`${uri}/api/v2/tickers`)
    if (response.status !== 200) {
      throw new Error(response.statusText)
    }
    const json = asWazirxResponse(await response.json())
    rates[currentTime] = wazirxRateMap(json)
  } catch (e) {
    logger('No wazirx quote:', e)
  }
  return rates
}

export { wazirx }
