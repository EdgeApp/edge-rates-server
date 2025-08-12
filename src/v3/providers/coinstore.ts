import { asNumber, asObject, asString, asTuple, asValue } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../../config'
import { NumberMap, RateBuckets, RateProvider, TokenMap } from '../types'
import {
  expandReturnedCryptoRates,
  isCurrent,
  reduceRequestedCryptoRates
} from '../utils'

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

const coinstoreTokenIdMap: TokenMap = {
  liberland: {
    id: 'LLD',
    displayName: 'Liberland Dollar'
  }
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
    const rightNow = new Date()

    const rateBuckets = reduceRequestedCryptoRates(
      requestedRates,
      rightNow,
      coinstoreTokenIdMap
    )

    const allResults: RateBuckets = new Map()
    const promises: Array<Promise<void>> = []
    rateBuckets.forEach((ids, date) => {
      if (isCurrent(new Date(date), rightNow) && ids.has('LLD')) {
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
      rightNow,
      allResults,
      coinstoreTokenIdMap
    )
    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  }
}
