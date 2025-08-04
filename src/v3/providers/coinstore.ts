import { asNumber, asObject, asString, asTuple, asValue } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../../config'
import { NumberMap, RateBuckets, RateProvider } from '../types'
import { expandReturnedCryptoRates, reduceRequestedCryptoRates } from '../utils'

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

const fetchCoinstore = async (): Promise<NumberMap> => {
  const response = await fetch(`${uri}/api/v1/ticker/price;symbol=LLDUSDT`)
  if (response.status !== 200) {
    throw new Error(response.statusText)
  }
  const json = await response.json()
  const data = asCoinstoreResponse(json)
  const lldPrice = parseFloat(data.data[0].price)
  return { LLD: lldPrice }
}

const coinstoreTokenIdMap = {
  liberland: {
    id: 'LLD',
    slug: 'lld'
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

export const coinstore: RateProvider = {
  providerId: 'coinstore',
  type: 'api',
  getCryptoRates: async ({ targetFiat, requestedRates }) => {
    // This is a LLD-only provider so we can check to exit early
    if (targetFiat !== 'USD') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rateBuckets = reduceRequestedCryptoRates(
      requestedRates,
      ONE_MINUTE,
      coinstoreTokenIdMap
    )

    const currentDate = new Date()
    const allResults: RateBuckets = new Map()
    const promises: Array<Promise<void>> = []
    rateBuckets.forEach((ids, date) => {
      if (isCurrent(new Date(date), currentDate) && ids.has('LLD')) {
        promises.push(
          fetchCoinstore().then(results => {
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
      coinstoreTokenIdMap
    )
    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  }
}
