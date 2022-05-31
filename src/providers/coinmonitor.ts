import { asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { ExchangeRateReq } from '../exchangeRateRouter'
import { NewRates, RateMap } from './../rates'
import { logger } from './../utils/utils'

const { uri } = config.providers.coinmonitor

const asCoinmonitorTickerResponse = asObject({ mediana_prom: asString })

const coinmonitorRateMap = (
  results: ReturnType<typeof asCoinmonitorTickerResponse>
): RateMap => ({ 'BTC_iso:ARS': results.mediana_prom })

const coinmonitor = async (
  requestedRates: ExchangeRateReq[],
  currentTime: string
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  // This is a BTC-only provider so we can check to exit early
  if (requestedRates.find(req => req.currency_pair === 'BTC_iso:ARS') == null)
    return rates

  // Query
  try {
    const response = await fetch(`${uri}/api/v3/btc_ars`)
    if (response.status !== 200) {
      throw new Error(response.statusText)
    }
    const json = asCoinmonitorTickerResponse(await response.json())
    rates[currentTime] = coinmonitorRateMap(json)
  } catch (e) {
    logger(`No coinmonitor quote`, e)
  }

  return rates
}

export { coinmonitor }
