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
  reduceRequestedFiatRates
} from '../utils'

const couchDB = connectCouch(config.couchUri)
export const dbSettings: nano.DocumentScope<any> =
  couchDB.default.db.use<any>('rates_settings')
export const dbData: nano.DocumentScope<RateDocument> =
  couchDB.default.db.use<RateDocument>('rates_data')

const ONE_MINUTE = 60 * 1000
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

export const couch: RateProvider = {
  providerId: 'couch',
  type: 'db',
  getCryptoRates: async ({ targetFiat, requestedRates }) => {
    const rateBuckets = reduceRequestedCryptoRates(requestedRates, ONE_MINUTE)

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
        const fiatMapDate = allResults.get(result.id) ?? {}
        let fiatMultiplier = 1
        if (targetFiat !== 'USD') {
          if (fiatMapDate[targetFiat] == null) {
            continue
          }
          fiatMultiplier = fiatMapDate[targetFiat]
        }

        Object.entries(rateDoc.crypto).forEach(([id, rate]) => {
          cryptoMapDate[id] = rate.USD * fiatMultiplier
        })
        allResults.set(result.id, cryptoMapDate)
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
        let fiatMultiplier = 1
        if (targetFiat !== 'USD') {
          if (fiatMapDate[targetFiat] == null) {
            continue
          }
          fiatMultiplier = fiatMapDate[targetFiat]
        }

        Object.entries(rateDoc.fiat).forEach(([id, rate]) => {
          fiatMapDate[id] = rate.USD * fiatMultiplier
        })
        allResults.set(result.id, fiatMapDate)
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

    const cryptoRateBuckets = reduceRequestedCryptoRates(
      params.crypto,
      ONE_MINUTE
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
        doc.crypto[`${rate.asset.pluginId}_${String(rate.asset.tokenId)}`] = {
          currencyCode: '',
          USD: rate.rate
        }
      })
    }

    await dbData.bulk({
      docs: cryptoDocs
    })

    const fiatRateBuckets = reduceRequestedFiatRates(
      params.fiat,
      TWENTY_FOUR_HOURS
    )

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
