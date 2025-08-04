import { asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../../config'
import { NumberMap, RateBuckets, RateProvider } from '../types'
import { expandReturnedCryptoRates, reduceRequestedCryptoRates } from '../utils'

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

const ONE_MINUTE = 60 * 1000

const isCurrent = (isoDate: Date, nowDate: Date): boolean => {
  const requestedDate = isoDate.getTime()
  const rightNow = nowDate.getTime()
  if (requestedDate > rightNow || requestedDate + ONE_MINUTE < rightNow) {
    return false
  }
  return true
}

export const coinmonitor: RateProvider = {
  providerId: 'coinmonitor',
  type: 'api',
  getCryptoRates: async ({ targetFiat, requestedRates }) => {
    // This is a BTC-to-ARS-only provider so we can check to exit early
    if (
      targetFiat !== 'ARS' ||
      ![...requestedRates.values()].some(
        r => r.asset.pluginId === 'bitcoin' && r.asset.tokenId == null
      )
    ) {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rateBuckets = reduceRequestedCryptoRates(
      requestedRates,
      ONE_MINUTE,
      coinmonitorTokenIdMap
    )

    const currentDate = new Date()
    const allResults: RateBuckets = new Map()
    const promises: Array<Promise<void>> = []
    rateBuckets.forEach((ids, date) => {
      if (isCurrent(new Date(date), currentDate)) {
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
      ONE_MINUTE,
      allResults,
      coinmonitorTokenIdMap
    )
    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  }
}
