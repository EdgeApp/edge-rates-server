import { asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../../config'
import { NumberMap, RateBuckets, RateProvider } from '../types'
import {
  expandReturnedCryptoRates,
  isCurrent,
  reduceRequestedCryptoRates
} from '../utils'

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

export const wazirx: RateProvider = {
  providerId: 'wazirx',
  type: 'api',
  getCryptoRates: async ({ targetFiat, requestedRates }) => {
    // This is a BTC-to-INR-only provider so we can check to exit early
    if (
      targetFiat !== 'INR' ||
      ![...requestedRates.values()].some(
        r => r.asset.pluginId === 'bitcoin' && r.asset.tokenId == null
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
      wazirxTokenIdMap
    )

    const allResults: RateBuckets = new Map()
    const promises: Array<Promise<void>> = []
    rateBuckets.forEach((ids, date) => {
      if (isCurrent(new Date(date), rightNow)) {
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
      rightNow,
      allResults,
      wazirxTokenIdMap
    )
    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  }
}
