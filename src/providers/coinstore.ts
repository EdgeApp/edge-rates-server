import { asNumber, asObject, asString, asTuple, asValue } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { NewRates, RateMap, ReturnRate } from '../rates'
import { logger } from '../utils/utils'

const { uri } = config.providers.coinstore

const asCoinstoreResponse = asObject({
  data: asTuple(
    asObject({
      id: asValue(922),
      symbol: asValue('LLDUSDT'),
      price: asString
    })
  ),
  code: asNumber
})

const coinstoreRateMap = (
  results: ReturnType<typeof asCoinstoreResponse>
): RateMap => ({ LLD_USDT: results.data[0].price })

const coinstore = async (
  requestedRates: ReturnRate[],
  currentTime: string
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  // This is a LLD-only provider so we can check to exit early
  if (requestedRates.find(req => req.currency_pair === 'LLD_iso:USD') == null) {
    return rates
  }

  // Query
  try {
    const response = await fetch(`${uri}/api/v1/ticker/price;symbol=LLDUSDT`)
    if (response.status !== 200) {
      throw new Error(response.statusText)
    }
    const json = asCoinstoreResponse(await response.json())
    rates[currentTime] = coinstoreRateMap(json)
  } catch (e) {
    logger('No coinstore quote:', e)
  }
  return rates
}

export { coinstore }
