import express from 'express'
import nano from 'nano'
import promisify from 'promisify-node'

import { defaultProviders } from '../providers/providers'
import {
  cleanRequestMiddleware,
  loadDocumentsMiddleware,
  postToSlackMiddleware,
  saveDocumentsMiddleware
} from '../router/commons'
import {
  asRateGetterDocument,
  asRateGetterParams,
  asRateProcessorResponse,
  asRatesGettersParams
} from '../types/cleaners'
import {
  OmitFirstArg,
  RateGetter,
  RateGetterParams,
  RateProcessor,
  RateProcessorResponse,
  RatesGetterDocument,
  ServerConfig,
  State
} from '../types/types'
import { config } from '../utils/config'
import { loadCouchdbDocuments, saveCouchdbDocuments } from '../utils/dbUtils'
import { processorWaterfall } from '../utils/processor'
import { curry, slackPoster } from '../utils/utils'
import {
  getBridgedRate,
  getDbBridgedRate,
  getExchangesRate,
  getExpiredRate,
  getFallbackConstantRate,
  getZeroRate
} from './rateGetters'

// const defaultGetters: RateGetter[] = [
//   getZeroRate, // Check if one of the currency is a zero rate currency.
//   getDbBridgedRate, // Try to get the rate from the db using bridged currencies.
//   getExchangesRate, // Try to get the rate from any of the exchanges.
//   getBridgedRate, // Try to get the rate from any of the exchanges using bridged currencies.
//   getFallbackConstantRate, // Check if the currencyPair or the inverted has a default rate value.
//   getExpiredRate // If no rate was found, and the request is old, set the rate to '0'.
// ]

export const getProcessorRate = async (
  rateGetter: OmitFirstArg<RateGetter>,
  params: RateGetterParams,
  initState: State<RatesGetterDocument> = {}
): Promise<RateProcessorResponse> => {
  const document = asRateGetterDocument(params.date)(initState)
  const resCleaner = asRateProcessorResponse(params)

  return Promise.resolve(rateGetter(params, document)).then(res =>
    resCleaner(res)
  )
}

export const exchangeRateRouter = (
  serverConfig: ServerConfig = config
): express.Router => {
  const { dbFullpath, dbName } = serverConfig

  const router = express.Router()
  const localDB = promisify(nano(dbFullpath).db.use(dbName))
  const save = curry(saveCouchdbDocuments)({ localDB })
  const load = curry(loadCouchdbDocuments)({ localDB })
  const slacker = curry(slackPoster)(serverConfig)

  // const dbRateProcessor = (_params, doc) => load(doc)

  const [
    zeroRateProcessor,
    dbBridgedRateProcessor,
    exchangesRateProcessor,
    bridgedRateProcessor,
    fallbackConstantRateProcessor,
    expiredRateProcessor
  ]: RateProcessor[] = [
    getZeroRate,
    getDbBridgedRate,
    getExchangesRate,
    getBridgedRate,
    getFallbackConstantRate,
    getExpiredRate
  ]
    .map(func => curry(func)({ ...serverConfig, exchanges: defaultProviders }))
    .map(func => curry(getProcessorRate)(func))

  const ratesProcessor = curry(processorWaterfall)([
    zeroRateProcessor,
    dbBridgedRateProcessor,
    exchangesRateProcessor,
    bridgedRateProcessor,
    fallbackConstantRateProcessor,
    expiredRateProcessor
  ])

  // console.log(ratesProcessor)

  router.get(
    '/exchangeRate',
    cleanRequestMiddleware(asRateGetterParams) as express.RequestHandler
  )
  router.post(
    '/exchangeRates',
    cleanRequestMiddleware(asRatesGettersParams) as express.RequestHandler
  )

  router.use(loadDocumentsMiddleware(load) as express.RequestHandler)
  // router.use(ratesMiddleware(serverConfig) as express.RequestHandler)
  router.use(saveDocumentsMiddleware(save) as express.RequestHandler)
  router.use(postToSlackMiddleware(slacker) as express.ErrorRequestHandler)
  return router
}
