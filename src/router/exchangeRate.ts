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
import {
  asRateParams,
  asRatesParams,
  RateGetter,
  RateGetterOptions,
  RateMiddleware
} from '../types'
import { curry } from '../utils'
import { clean } from './cleaner'
import { saveDocuments } from './couchdb'

const defaultGetters: RateGetter[] = [
  getZeroRate, // Check if one of the currency is a zero rate currency.
  getDbRate, // Try to get the rate from the db.
  getDbBridgedRate, // Try to get the rate from the db using bridged currencies.
  getExchangesRate, // Try to get the rate from any of the exchanges.
  getBridgedRate, // Try to get the rate from any of the exchanges using bridged currencies.
  getFallbackConstantRate, // Check if the currencyPair or the inverted has a default rate value.
  getExpiredRate // If no rate was found, and the request is old, set the rate to '0'.
]

export const getRatesMiddleware = (
  opts: RateGetterOptions,
  getters: RateGetter[] = defaultGetters
): RateMiddleware => {
  const getterOptions = { ...opts, exchanges: defaultProviders }
  const rateGetters = getters.map(getter => curry(getter)(getterOptions))

  return async function(req, res, next): Promise<void> {
    const { documents, results } = await getRates(req.params, rateGetters)
    res.documents = documents
    res.results = results
    return next()
  }
}
export const exchangeRate = (opts: RateGetterOptions): RateMiddleware[] => [
  clean(asRateParams),
  getRatesMiddleware(opts),
  saveDocuments(opts.localDB),
  (_req, res, next) => {
    const result = res.results[0]
    if (result.error != null) return next(result.error)
    res.json(result)
  }
]

export const exchangeRates = (opts: RateGetterOptions): RateMiddleware[] => [
  clean(asRatesParams),
  getRatesMiddleware(opts),
  saveDocuments(opts.localDB),
  (_req, res) => {
    res.json(res.results)
  }
]
