import { asMaybe, asObject, asString, asValue, uncleaner } from 'cleaners'
import { asCouchDoc, bulkGet, connectCouch, CouchDoc } from 'edge-server-tools'
import nano from 'nano'

import { config } from '../../config'
import {
  asRateDocument,
  RateBuckets,
  RateDocument,
  RateProvider,
  UpdateRatesParams
} from '../types'
import {
  expandReturnedCryptoRates,
  expandReturnedFiatRates,
  groupCryptoRatesByTime,
  groupFiatRatesByTime,
  reduceRequestedCryptoRates,
  reduceRequestedFiatRates
} from '../utils'

const couchDB = connectCouch(config.couchUri)
export const dbSettings: nano.DocumentScope<any> =
  couchDB.default.db.use<any>('rates_settings')
export const dbData: nano.DocumentScope<RateDocument> =
  couchDB.default.db.use<RateDocument>('rates_data')

const asRatesDoc = asCouchDoc(asRateDocument)
const wasRatesDoc = uncleaner(asRatesDoc)

export const couch: RateProvider = {
  providerId: 'couch',
  type: 'db',
  getCryptoRates: async ({ targetFiat, requestedRates }, rightNow) => {
    if (targetFiat !== 'USD') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rateBuckets = reduceRequestedCryptoRates(requestedRates, rightNow)

    const allResults: RateBuckets = new Map()

    const documents = await bulkGet<RateDocument[]>(
      config.couchUri,
      'rates_data',
      Array.from(rateBuckets.keys()).map(id => ({ id }))
    )

    for (const result of documents.results) {
      for (const doc of result.docs) {
        if ('error' in doc) continue

        // Handle deleted documents
        const maybeDeletedDoc = asMaybe(asDeletedCouchDoc)(doc.ok)
        if (maybeDeletedDoc != null) {
          continue
        }

        const rateDoc = asRatesDoc(doc.ok).doc
        const cryptoMapDate = allResults.get(result.id) ?? {}

        Object.entries(rateDoc.crypto).forEach(([pluginIdTokenId, rate]) => {
          cryptoMapDate[pluginIdTokenId] = rate.USD
        })
        allResults.set(result.id, cryptoMapDate)
      }
    }

    const out = expandReturnedCryptoRates(requestedRates, rightNow, allResults)

    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  },
  getFiatRates: async ({ targetFiat, requestedRates }) => {
    if (targetFiat !== 'USD') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rateBuckets = reduceRequestedFiatRates(requestedRates)

    const allResults: RateBuckets = new Map()

    const documents = await bulkGet<RateDocument>(
      config.couchUri,
      'rates_data',
      Array.from(rateBuckets.keys()).map(id => ({ id }))
    )

    for (const result of documents.results) {
      for (const doc of result.docs) {
        if ('error' in doc) continue

        // Handle deleted documents
        const maybeDeletedDoc = asMaybe(asDeletedCouchDoc)(doc.ok)
        if (maybeDeletedDoc != null) {
          continue
        }

        const rateDoc = asRatesDoc(doc.ok).doc

        const fiatMapDate = allResults.get(result.id) ?? {}

        Object.entries(rateDoc.fiat).forEach(([fiatCode, rate]) => {
          fiatMapDate[fiatCode] = rate.USD
        })
        allResults.set(result.id, fiatMapDate)
      }
    }

    const out = expandReturnedFiatRates(requestedRates, allResults)

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
    const fiatRateBuckets = groupFiatRatesByTime(params.fiat)

    const ids = new Set<string>([
      ...cryptoRateBuckets.keys(),
      ...fiatRateBuckets.keys()
    ])

    const bulkGetResult = await bulkGet<nano.Document & RateDocument>(
      config.couchUri,
      'rates_data',
      Array.from(ids.keys()).map(id => ({ id }))
    )

    const docsMap = new Map<string, CouchDoc<RateDocument>>()

    for (const result of bulkGetResult.results) {
      const document = result.docs[0]

      // Handle missing documents
      if ('error' in document) {
        docsMap.set(result.id, {
          id: result.id,
          doc: {
            crypto: {},
            fiat: {}
          }
        })
        continue
      }

      // Handle deleted documents
      const maybeDeletedDoc = asMaybe(asDeletedCouchDoc)(document.ok)
      if (maybeDeletedDoc != null) {
        docsMap.set(result.id, {
          id: result.id,
          doc: {
            crypto: {},
            fiat: {}
          }
        })
        continue
      }

      // Handle existing documents
      const couchDoc = asRatesDoc(document.ok)
      docsMap.set(result.id, couchDoc)
    }

    cryptoRateBuckets.forEach((rates, date) => {
      const couchDoc = docsMap.get(date)
      if (couchDoc == null) {
        return
      }
      couchDoc.doc.crypto = {
        ...couchDoc.doc.crypto,
        ...Object.entries(rates).reduce((acc, [asset, rate]) => {
          acc[asset] = {
            USD: rate
          }
          return acc
        }, {})
      }
    })
    fiatRateBuckets.forEach((rates, date) => {
      const couchDoc = docsMap.get(date)
      if (couchDoc == null) {
        return
      }
      couchDoc.doc.fiat = {
        ...couchDoc.doc.fiat,
        ...Object.entries(rates).reduce((acc, [fiat, rate]) => {
          acc[fiat] = {
            USD: rate
          }
          return acc
        }, {})
      }
    })

    await dbData.bulk({
      docs: Array.from(docsMap.values()).map(wasRatesDoc)
    })
  },
  engines: []
}

const asDeletedCouchDoc = asObject({
  _id: asString,
  _rev: asMaybe(asString),
  _deleted: asValue(true)
})
