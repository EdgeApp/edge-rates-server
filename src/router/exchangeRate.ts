import nano from 'nano'
import promisify from 'promisify-node'

import { config } from '../config'
import { defaultProviders } from '../providers/providers'
import { getBridgedRate } from '../rates/currencyBridge'
import {
  getDbBridgedRate,
  getDbRate,
  getExchangesRate,
  getExpiredRate,
  getFallbackConstantRate,
  getZeroRate
} from '../rates/rateHelpers'
import { getRates } from '../rates/rates'
import { asRateParams, asRatesParams, RateGetter } from '../types'
import { curry } from '../utils'
import { clean } from './cleaner'
import { saveDocuments } from './couchdb'

// Nano for CouchDB
// =============================================================================
const nanoDb = nano(config.dbFullpath)
const dbRates = nanoDb.db.use('db_rates')
promisify(dbRates)

const defaultGetters: RateGetter[] = [
  getZeroRate, // Check if one of the currency is a zero rate currency.
  getDbRate, // Try to get the rate from the db.
  getDbBridgedRate, // Try to get the rate from the db using bridged currencies.
  getExchangesRate, // Try to get the rate from any of the exchanges.
  getBridgedRate, // Try to get the rate from any of the exchanges using bridged currencies.
  getFallbackConstantRate, // Check if the currencyPair or the inverted has a default rate value.
  getExpiredRate // If no rate was found, and the request is old, set the rate to '0'.
].map(getter =>
  curry(getter)({
    ...config,
    localDb: dbRates,
    exchanges: defaultProviders
  })
)

export const getRatesMiddleware = (getters: RateGetter[] = defaultGetters) =>
  async function(req, res, next): Promise<void> {
    const { documents, results } = await getRates(req.params, getters)
    res.documents = documents
    res.results = results
    return next()
  }

export const exchangeRate = [
  clean(asRateParams),
  getRatesMiddleware(),
  saveDocuments(dbRates),
  (req, res): void => {
    const result = res.results[0]
    if (result.error != null) res.status(400)
    res.json(result)
  }
]

export const exchangeRates = [
  clean(asRatesParams),
  getRatesMiddleware(),
  saveDocuments(dbRates),
  (req, res): void => res.json(res.results)
]
