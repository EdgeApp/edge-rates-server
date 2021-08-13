import { asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { NewRates, RateMap, ReturnRate } from './../rates'
import { logger } from './../utils/utils'

const { uri } = config.providers.coinmonitor

const asCoinmonitorTickerResponse = asObject({ mediana_prom: asString })

const coinmonitorRateMap = (
  results: ReturnType<typeof asCoinmonitorTickerResponse>
): RateMap => ({ 'BTC_iso:ARS': results.mediana_prom })

const coinmonitor = async (
  requestedRates: ReturnRate[],
  currentTime: string
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  // Query
  try {
    const response = await fetch(`${uri}/api/v3/btc_ars`)
    if (response.status !== 200) {
      throw new Error(response.statusText)
    }
    const json = asCoinmonitorTickerResponse(await response.json())
    rates[currentTime] = coinmonitorRateMap(json)
  } catch (e) {
    logger(`No coinmonitor quote: ${e.message}`)
  }

  return rates
}

export { coinmonitor }
