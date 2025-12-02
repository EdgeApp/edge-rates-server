import { createClient } from 'redis'

import { logger } from '../../utils/utils'
import { ONE_MINUTE, TWENTY_FOUR_HOURS } from '../constants'
import type { RateBuckets, RateProvider, UpdateRatesParams } from '../types'
import {
  expandReturnedCryptoRates,
  expandReturnedFiatRates,
  groupCryptoRatesByTime,
  groupFiatRatesByTime,
  reduceRequestedCryptoRates,
  reduceRequestedFiatRates
} from '../utils'

export const client = createClient()
client.on('connect', () => {
  logger('onConnect to Redis')
})

client.on('error', (err: unknown) => {
  logger('Redis connection error:', String(err))
})
client.connect().catch(e => {
  logger('redis connect error: ', e)
})

export const hsetAsync = client.hSet.bind(client)
export const hmgetAsync = client.hmGet.bind(client)
export const getAsync = client.get.bind(client)
// this is to navigate a type error
export const setAsync = async (
  key: string,
  value: string
): Promise<string | null> => {
  return await client.set(key, value)
}

const normalizeDate = (date: string, intervalMs: number): string => {
  const rateTime = new Date(date).getTime()

  // Floor to the start of the interval
  const bucketTime = Math.floor(rateTime / intervalMs) * intervalMs
  return new Date(bucketTime).toISOString()
}

// redis docs to be named {couchdb name}:{date}:{crypto or fiat}
export const redis: RateProvider = {
  providerId: 'redis',
  type: 'memory',
  getCryptoRates: async ({ targetFiat, requestedRates }, rightNow) => {
    if (targetFiat !== 'USD') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rateBuckets = reduceRequestedCryptoRates(requestedRates, rightNow)

    const allResults: RateBuckets = new Map()
    for (const [date, cryptoPairs] of rateBuckets.entries()) {
      const normalizedDate = normalizeDate(date, ONE_MINUTE)
      const cryptoRedisKey = `rates_data:${normalizedDate}:crypto`
      const cryptoPairsArray = Array.from(cryptoPairs.values())
      const rates = await hmgetAsync(cryptoRedisKey, cryptoPairsArray)

      for (let i = 0; i < cryptoPairsArray.length; i++) {
        const rate = rates[i]
        if (rate == null) continue
        const cryptoPair = cryptoPairsArray[i]
        const cryptoMapDate = allResults.get(normalizedDate) ?? {}
        cryptoMapDate[cryptoPair] = Number(rate)
        allResults.set(normalizedDate, cryptoMapDate)
      }
    }

    const out = expandReturnedCryptoRates(requestedRates, rightNow, allResults)

    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  },
  getFiatRates: async ({ targetFiat, requestedRates }, rightNow) => {
    if (targetFiat !== 'USD') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rateBuckets = reduceRequestedFiatRates(requestedRates, rightNow)

    const allResults: RateBuckets = new Map()
    for (const [date, fiatPairs] of rateBuckets.entries()) {
      const normalizedDate = normalizeDate(date, TWENTY_FOUR_HOURS)
      const fiatRedisKey = `rates_data:${normalizedDate}:fiat`
      const fiatPairsArray = Array.from(fiatPairs.values())
      const rates = await hmgetAsync(fiatRedisKey, fiatPairsArray)

      for (let i = 0; i < fiatPairsArray.length; i++) {
        const rate = rates[i]
        if (rate == null) continue
        const fiatPair = fiatPairsArray[i]
        const fiatMapDate = allResults.get(normalizedDate) ?? {}
        fiatMapDate[fiatPair] = Number(rate)
        allResults.set(normalizedDate, fiatMapDate)
      }
    }

    const out = expandReturnedFiatRates(requestedRates, allResults)

    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  },
  updateRates: async (
    params: UpdateRatesParams,
    rightNow: Date
  ): Promise<void> => {
    if (params.targetFiat !== 'USD') {
      return
    }

    if (params.crypto.size === 0 && params.fiat.size === 0) {
      return
    }

    const cryptoRateBuckets = groupCryptoRatesByTime(params.crypto, rightNow)
    for (const [date, cryptoRates] of cryptoRateBuckets.entries()) {
      const cryptoRedisKey = `rates_data:${date}:crypto`
      await hsetAsync(cryptoRedisKey, cryptoRates)
    }

    const fiatRateBuckets = groupFiatRatesByTime(params.fiat, rightNow)
    for (const [date, fiatRates] of fiatRateBuckets.entries()) {
      const fiatRedisKey = `rates_data:${date}:fiat`
      await hsetAsync(fiatRedisKey, fiatRates)
    }
  },
  engines: []
}
