import { asNumber, asObject } from 'cleaners'
import { syncedDocument } from 'edge-server-tools'

import type { NumberMap, RateBuckets, RateProvider } from '../types'
import {
  create30MinuteSyncInterval,
  expandReturnedCryptoRates,
  reduceRequestedCryptoRates
} from '../utils'
import { dbSettings } from './couch'

const constantRateSyncDoc = syncedDocument('constantrates', asObject(asNumber))
create30MinuteSyncInterval(constantRateSyncDoc, dbSettings)

export const constantRates: RateProvider = {
  providerId: 'constantRates',
  type: 'api',
  getCryptoRates: async ({ targetFiat, requestedRates }, rightNow) => {
    if (targetFiat !== 'USD') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rateBuckets = reduceRequestedCryptoRates(requestedRates, rightNow)

    const allResults: RateBuckets = new Map()
    rateBuckets.forEach((ids, date) => {
      const dateResults: NumberMap = {}
      ids.forEach(pluginIdTokenId => {
        const rate = constantRateSyncDoc.doc[pluginIdTokenId]
        if (rate != null) {
          dateResults[pluginIdTokenId] = rate
        }
      })
      if (Object.keys(dateResults).length > 0) {
        allResults.set(date, dateResults)
      }
    })

    const out = expandReturnedCryptoRates(requestedRates, rightNow, allResults)

    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  },
  documents: [
    {
      name: 'rates_settings',
      templates: {
        constantrates: {}
      },
      syncedDocuments: [constantRateSyncDoc]
    }
  ],
  engines: []
}
