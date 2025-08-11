import { asNumber, asObject, asString, asTuple, asValue } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../../config'
import { NumberMap, RateBuckets, RateProvider } from '../types'
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

const coinstoreTokenIdMap = {
  liberland: {
    id: 'LLD',
    slug: 'lld'
  }
}

export const coinstore: RateProvider = {
  providerId: 'coinstore',
  type: 'api',
  getCryptoRates: async ({ targetFiat, requestedRates }) => {
    // This is a LLD-only provider so we can check to exit early
    if (
      targetFiat !== 'USD' ||
      ![...requestedRates.values()].some(
        r => r.asset.pluginId === 'liberland' && r.asset.tokenId == null
      )
    ) {
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
      if (isCurrent(new Date(date), rightNow)) {
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
