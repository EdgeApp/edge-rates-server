import { asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../../config'
import { NumberMap, RateBuckets, RateProvider } from '../types'
import {
  expandReturnedCryptoRates,
  isCurrent,
  reduceRequestedCryptoRates
} from '../utils'

const { uri } = config.providers.coinmonitor

const asCoinmonitorTickerResponse = asObject({ mediana_prom: asString })

const fetchCoinmonitor = async (): Promise<NumberMap> => {
  const response = await fetch(`${uri}/api/v3/btc_ars`)
  if (response.status !== 200) {
    throw new Error(response.statusText)
  }
  const json = await response.json()
  const data = asCoinmonitorTickerResponse(json)
  const btcPrice = parseFloat(data.mediana_prom)
  return { bitcoin: btcPrice }
}

const coinmonitorTokenIdMap = {
  bitcoin: {
    id: 'bitcoin',
    slug: 'bitcoin'
  }
}

export const coinmonitor: RateProvider = {
  providerId: 'coinmonitor',
  type: 'api',
  getCryptoRates: async ({ targetFiat, requestedRates }) => {
    // This is a BTC-to-ARS-only provider so we can check to exit early
    if (targetFiat !== 'ARS') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }
    const rightNow = new Date()

    const rateBuckets = reduceRequestedCryptoRates(
      requestedRates,
      rightNow,
      coinmonitorTokenIdMap
    )

    const allResults: RateBuckets = new Map()
    const promises: Array<Promise<void>> = []
    rateBuckets.forEach((ids, date) => {
      if (isCurrent(new Date(date), rightNow) && ids.has('bitcoin')) {
        promises.push(
          fetchCoinmonitor().then(results => {
            allResults.set(date, results)
          })
        )
      }
    })
    await Promise.all(promises)

    const out = expandReturnedCryptoRates(
      requestedRates,
      rightNow,
      allResults,
      coinmonitorTokenIdMap
    )
    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  }
}
