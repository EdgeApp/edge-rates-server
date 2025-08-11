import { asMaybe, asObject, asValue } from 'cleaners'
import { asCouchDoc, bulkGet, connectCouch } from 'edge-server-tools'
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
  reduceRequestedCryptoRates,
  reduceRequestedFiatRates,
  toCryptoKey
} from '../utils'

const couchDB = connectCouch(config.couchUri)
export const dbSettings: nano.DocumentScope<any> =
  couchDB.default.db.use<any>('rates_settings')
export const dbData: nano.DocumentScope<RateDocument> =
  couchDB.default.db.use<RateDocument>('rates_data')

export const couch: RateProvider = {
  providerId: 'couch',
  type: 'db',
  getCryptoRates: async ({ targetFiat, requestedRates }) => {
    if (targetFiat !== 'USD') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rightNow = new Date()
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

        const rateDoc = asCouchDoc(asRateDocument)(doc.ok).doc
        const cryptoMapDate = allResults.get(result.id) ?? {}

        Object.entries(rateDoc.crypto).forEach(([id, rate]) => {
          cryptoMapDate[id] = rate.USD
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

    const documents = await bulkGet<RateDocument[]>(
      config.couchUri,
      'rates_data',
      Array.from(rateBuckets.keys()).map(id => ({ id }))
    )

    for (const result of documents.results) {
      for (const doc of result.docs) {
        if ('error' in doc) continue

        const rateDoc = asCouchDoc(asRateDocument)(doc.ok).doc

        const fiatMapDate = allResults.get(result.id) ?? {}

        Object.entries(rateDoc.fiat).forEach(([id, rate]) => {
          fiatMapDate[id] = rate.USD
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

    const rightNow = new Date()
    const cryptoRateBuckets = reduceRequestedCryptoRates(
      params.crypto,
      rightNow
    )

    const cryptoDocs: Array<{
      _id: string
      _rev?: string
      crypto: RateDocument['crypto']
      fiat: RateDocument['fiat']
    }> = []
    const dbCryptoDocuments = await bulkGet<RateDocument[]>(
      config.couchUri,
      'rates_data',
      Array.from(cryptoRateBuckets.keys()).map(id => ({ id }))
    )
    for (const result of dbCryptoDocuments.results) {
      for (const doc of result.docs) {
        if ('error' in doc) {
          const missingDocumentError = asMaybe(asCouchMissingDocumentError)(
            doc.error
          )
          if (missingDocumentError != null) {
            cryptoDocs.push({
              _id: result.id,
              crypto: {},
              fiat: {}
            })
          }
        } else if (doc.ok.length > 0) {
          cryptoDocs.push({
            _id: result.id,
            crypto: doc.ok[0].crypto,
            fiat: doc.ok[0].fiat
          })
        }
      }
    }

    for (const doc of cryptoDocs) {
      params.crypto.forEach(rate => {
        if (rate.rate == null) {
          return
        }
        doc.crypto[toCryptoKey(rate.asset)] = {
          currencyCode: '',
          USD: rate.rate
        }
      })
    }

    await dbData.bulk({
      docs: cryptoDocs
    })

    const fiatRateBuckets = reduceRequestedFiatRates(params.fiat)

    const fiatDocs: Array<{
      _id: string
      _rev?: string
      crypto: RateDocument['crypto']
      fiat: RateDocument['fiat']
    }> = []
    const dbFiatDocuments = await bulkGet<RateDocument[]>(
      config.couchUri,
      'rates_data',
      Array.from(fiatRateBuckets.keys()).map(id => ({ id }))
    )
    for (const result of dbFiatDocuments.results) {
      for (const doc of result.docs) {
        if ('error' in doc) {
          const missingDocumentError = asMaybe(asCouchMissingDocumentError)(
            doc.error
          )
          if (missingDocumentError != null) {
            fiatDocs.push({
              _id: result.id,
              crypto: {},
              fiat: {}
            })
          }
        } else if (doc.ok.length > 0) {
          fiatDocs.push({
            _id: result.id,
            crypto: doc.ok[0].crypto,
            fiat: doc.ok[0].fiat
          })
        }
      }
    }

    for (const doc of fiatDocs) {
      params.fiat.forEach(rate => {
        if (rate.rate == null) {
          return
        }
        doc.fiat[rate.fiatCode] = {
          USD: rate.rate
        }
      })
    }

    await dbData.bulk({
      docs: fiatDocs
    })
  },
  engines: []
}

const asCouchMissingDocumentError = asObject({
  error: asValue('not_found'),
  reason: asValue('missing')
})
