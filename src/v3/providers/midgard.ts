import { asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../../config'
import { NumberMap, RateBuckets, RateProvider } from '../types'
import { expandReturnedCryptoRates, reduceRequestedCryptoRates } from '../utils'

const { uri } = config.providers.midgard

const asMidgardTcyResponse = asObject({
  assetPriceUSD: asString
})

const fetchMidgard = async (): Promise<NumberMap> => {
  const response = await fetch(`${uri}/v2/pool/THOR.TCY`)
  if (response.status !== 200) {
    throw new Error(response.statusText)
  }
  const json = await response.json()
  const data = asMidgardTcyResponse(json)
  const tcyPrice = parseFloat(data.assetPriceUSD)
  return { TCY: tcyPrice }
}

const midgardTokenIdMap = {
  thorchainrune_tcy: {
    id: 'TCY',
    slug: 'tcy'
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

export const midgard: RateProvider = {
  providerId: 'midgard',
  type: 'api',
  getCryptoRates: async ({ targetFiat, requestedRates }) => {
    if (
      targetFiat !== 'USD' ||
      ![...requestedRates.values()].some(
        r => r.asset.pluginId === 'thorchainrune' && r.asset.tokenId === 'tcy'
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
      midgardTokenIdMap
    )

    const currentDate = new Date()
    const allResults: RateBuckets = new Map()
    const promises: Array<Promise<void>> = []
    rateBuckets.forEach((ids, date) => {
      if (isCurrent(new Date(date), currentDate)) {
        promises.push(
          fetchMidgard().then(results => {
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
      midgardTokenIdMap
    )
    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  }
}
