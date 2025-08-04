import { asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../../config'
import { NumberMap, RateBuckets, RateProvider } from '../types'
import { expandReturnedCryptoRates, reduceRequestedCryptoRates } from '../utils'

const { uri } = config.providers.wazirx

const asWazirxResponse = asObject({ btcinr: asObject({ last: asString }) })

const fetchWazirx = async (): Promise<NumberMap> => {
  const response = await fetch(`${uri}/api/v2/tickers`)
  if (response.status !== 200) {
    throw new Error(response.statusText)
  }
  const json = await response.json()
  const data = asWazirxResponse(json)
  const btcPrice = parseFloat(data.btcinr.last)
  return { bitcoin: btcPrice }
}

const wazirxTokenIdMap = {
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

export const wazirx: RateProvider = {
  providerId: 'wazirx',
  type: 'api',
  getCryptoRates: async ({ targetFiat, requestedRates }) => {
    // This is a BTC-to-INR-only provider so we can check to exit early
    if (targetFiat !== 'INR') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rateBuckets = reduceRequestedCryptoRates(
      requestedRates,
      ONE_MINUTE,
      wazirxTokenIdMap
    )

    const currentDate = new Date()
    const allResults: RateBuckets = new Map()
    const promises: Array<Promise<void>> = []
    rateBuckets.forEach((ids, date) => {
      if (isCurrent(new Date(date), currentDate) && ids.has('bitcoin')) {
        promises.push(
          fetchWazirx().then(results => {
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
      wazirxTokenIdMap
    )
    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  }
}
