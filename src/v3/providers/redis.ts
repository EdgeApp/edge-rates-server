import { mul } from 'biggystring'
import { createClient } from 'redis'

import { logger } from '../../utils/utils'
import {
  CryptoRateMap,
  FiatRateMap,
  RateBuckets,
  RateProvider,
  UpdateRatesParams
} from '../types'
import {
  expandReturnedCryptoRates,
  expandReturnedFiatRates,
  reduceRequestedCryptoRates,
  reduceRequestedFiatRates
} from '../utils'

const client = createClient()
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

const ONE_MINUTE = 60 * 1000
const FIVE_MINUTES = 5 * 60 * 1000
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

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
  getCryptoRates: async ({ targetFiat, requestedRates }) => {
    const rateBuckets = reduceRequestedCryptoRates(requestedRates, ONE_MINUTE)

    const allResults: RateBuckets = new Map()
    for (const [date, cryptoPairs] of rateBuckets.entries()) {
      let fiatMultiplier = '1'
      if (targetFiat !== 'USD') {
        const fiatDate = normalizeDate(date, TWENTY_FOUR_HOURS)
        const fiatRedisKey = `rates_data:${fiatDate}:fiat`
        const [targetFiatRate] = await hmgetAsync(fiatRedisKey, targetFiat)
        if (targetFiatRate == null) continue
        fiatMultiplier = targetFiatRate
      }

      const normalizedDate = normalizeDate(date, ONE_MINUTE)
      const cryptoRedisKey = `rates_data:${normalizedDate}:crypto`
      const cryptoPairsArray = Array.from(cryptoPairs.values())
      const rates = await hmgetAsync(cryptoRedisKey, cryptoPairsArray)

      for (let i = 0; i < cryptoPairsArray.length; i++) {
        const rate = rates[i]
        if (rate == null) continue
        const cryptoPair = cryptoPairsArray[i]
        const cryptoMapDate = allResults.get(normalizedDate) ?? {}
        cryptoMapDate[cryptoPair] = Number(mul(rate, fiatMultiplier))
        allResults.set(normalizedDate, cryptoMapDate)
      }
    }

    const out = expandReturnedCryptoRates(
      requestedRates,
      ONE_MINUTE,
      allResults
    )

    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  },
  getFiatRates: async ({ targetFiat, requestedRates }) => {
    const rateBuckets = reduceRequestedFiatRates(
      requestedRates,
      TWENTY_FOUR_HOURS
    )

    const allResults: RateBuckets = new Map()
    for (const [date, fiatPairs] of rateBuckets.entries()) {
      let fiatMultiplier = '1'
      if (targetFiat !== 'USD') {
        const fiatDate = normalizeDate(date, TWENTY_FOUR_HOURS)
        const fiatRedisKey = `rates_data:${fiatDate}:fiat`
        const [targetFiatRate] = await hmgetAsync(fiatRedisKey, targetFiat)
        if (targetFiatRate == null) continue
        fiatMultiplier = targetFiatRate
      }

      const normalizedDate = normalizeDate(date, TWENTY_FOUR_HOURS)
      const fiatRedisKey = `rates_data:${normalizedDate}:fiat`
      const fiatPairsArray = Array.from(fiatPairs.values())
      const rates = await hmgetAsync(fiatRedisKey, fiatPairsArray)

      for (let i = 0; i < fiatPairsArray.length; i++) {
        const rate = rates[i]
        if (rate == null) continue
        const fiatPair = fiatPairsArray[i]
        const fiatMapDate = allResults.get(normalizedDate) ?? {}
        fiatMapDate[fiatPair] = Number(mul(rate, fiatMultiplier))
        allResults.set(normalizedDate, fiatMapDate)
      }
    }

    const out = expandReturnedFiatRates(
      requestedRates,
      TWENTY_FOUR_HOURS,
      allResults
    )

    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  },
  updateRates: async (params: UpdateRatesParams): Promise<void> => {
    if (params.targetFiat !== 'USD') {
      return
    }

    if (params.crypto.size === 0 && params.fiat.size === 0) {
      return
    }

    const cryptoRateBuckets = groupCryptoRatesByTime(params.crypto)
    for (const [date, cryptoRates] of cryptoRateBuckets.entries()) {
      const cryptoRedisKey = `rates_data:${date}:crypto`
      await hsetAsync(cryptoRedisKey, cryptoRates)
    }

    const fiatRateBuckets = groupFiatRatesByTime(params.fiat)
    for (const [date, fiatRates] of fiatRateBuckets.entries()) {
      const fiatRedisKey = `rates_data:${date}:fiat`
      await hsetAsync(fiatRedisKey, fiatRates)
    }
  },
  engines: []
}

// This function breaks apart the requested rates into buckets of the given interval.
type DateBuckets = Map<string, { [id: string]: number }>
export const groupCryptoRatesByTime = (
  requestedRates: CryptoRateMap
): DateBuckets => {
  const buckets: DateBuckets = new Map()
  const rightNowMs = new Date().getTime()

  requestedRates.forEach(cryptoRate => {
    if (cryptoRate.rate == null) return

    const rateTime = cryptoRate.isoDate.getTime()

    // Current rates (< five minutes old) use minute precision and historical rates use five minutes
    const intervalMs =
      rightNowMs - rateTime < FIVE_MINUTES ? ONE_MINUTE : FIVE_MINUTES

    // Floor to the start of the interval bucket
    const bucketTime = Math.floor(rateTime / intervalMs) * intervalMs
    const bucketKey = new Date(bucketTime).toISOString()
    const bucket = buckets.get(bucketKey) ?? {}
    bucket[`${cryptoRate.asset.pluginId}_${String(cryptoRate.asset.tokenId)}`] =
      cryptoRate.rate
    buckets.set(bucketKey, bucket)
  })

  return buckets
}

export const groupFiatRatesByTime = (
  requestedRates: FiatRateMap
): DateBuckets => {
  const buckets: DateBuckets = new Map()

  requestedRates.forEach(fiatRate => {
    if (fiatRate.rate == null) return

    const rateTime = fiatRate.isoDate.getTime()

    // Floor to the start of the interval bucket
    const bucketTime =
      Math.floor(rateTime / TWENTY_FOUR_HOURS) * TWENTY_FOUR_HOURS
    const bucketKey = new Date(bucketTime).toISOString()
    const bucket = buckets.get(bucketKey) ?? {}
    bucket[fiatRate.fiatCode] = fiatRate.rate
    buckets.set(bucketKey, bucket)
  })

  return buckets
}
