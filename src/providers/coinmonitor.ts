import { asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { NewRates, ReturnRate } from './../rates'
import { logger } from './../utils/utils'

const asCoinmonitorTickerResponse = asObject({ mediana_prom: asString })

const coinmonitor = async (
  requestedRates: ReturnRate[],
  currentTime: string
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  // Query
  try {
    const response = await fetch('http://ar.coinmonitor.info/api/v3/btc_ars')
    if (response.status !== 200) {
      throw new Error(response.statusText)
    }
    rates[currentTime][`BTC_iso:ARS`] = asCoinmonitorTickerResponse(
      await response.json()
    ).mediana_prom
  } catch (e) {
    logger(`No coinmonitor quote: ${e.message}`)
  }

  return rates
}

export { coinmonitor }
