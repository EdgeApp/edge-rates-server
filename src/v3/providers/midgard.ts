import { asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../../config'
import { NumberMap, RateBuckets, RateProvider, TokenMap } from '../types'
import {
  expandReturnedCryptoRates,
  isCurrent,
  reduceRequestedCryptoRates
} from '../utils'

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

const midgardTokenIdMap: TokenMap = {
  thorchainrune_tcy: {
    id: 'TCY',
    displayName: 'tcy'
  }
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

    const rightNow = new Date()
    const rateBuckets = reduceRequestedCryptoRates(
      requestedRates,
      rightNow,
      midgardTokenIdMap
    )

    const allResults: RateBuckets = new Map()
    const promises: Array<Promise<void>> = []
    rateBuckets.forEach((ids, date) => {
      if (isCurrent(new Date(date), rightNow)) {
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
      rightNow,
      allResults,
      midgardTokenIdMap
    )
    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  }
}
