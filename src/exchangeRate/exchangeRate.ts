import { Cleaner } from 'cleaners'
import express from 'express'
import nano from 'nano'
import promisify from 'promisify-node'

import { defaultProviders } from '../providers/providers'
import {
  asRateGetterDocument,
  asRateGetterParams,
  asRateProcessorResponse,
  asRatesGettersParams
} from '../types/cleaners'
import {
  DbLoadFunction,
  DbSaveFunction,
  ErrorType,
  InitState,
  OmitFirstArg,
  RateGetter,
  RateGetterParams,
  RateProcessor,
  RateProcessorResponse,
  RatesProcessorState,
  ServerConfig,
  ServerError
} from '../types/types'
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

const rateGetters = [
  getZeroRate,
  getDbBridgedRate,
  getExchangesRate,
  getBridgedRate,
  getFallbackConstantRate,
  getExpiredRate
]

export const serverError = <T>(
  params: T,
  message: string,
  errorType: ErrorType = 'server_error',
  errorCode: number = 500
): ServerError & T => ({ message, errorCode, errorType, ...params })

export const cleanerProcessor = async <T>(
  cleaner: Cleaner<T>,
  params: T
): Promise<T | { error: ServerError }> =>
  await Promise.resolve(cleaner(params)).catch(e => ({
    error: serverError(params, e.message, 'bad_query', 400)
  }))

export const rateProcessor = async (
  rateGetter: OmitFirstArg<RateGetter>,
  params: RateGetterParams,
  documents: RatesProcessorState = {}
): Promise<RateProcessorResponse> => {
  const docCleaner = asRateGetterDocument(params)
  const resCleaner = asRateProcessorResponse(params)

  return await Promise.resolve(rateGetter(params, docCleaner(documents)))
    .then(res => resCleaner(res))
    .catch(e => ({ error: e, documents }))
}

export const loadProcessor = async (
  load: OmitFirstArg<DbLoadFunction>,
  params: RateGetterParams | RateGetterParams[],
  documents: InitState = {}
): Promise<RateProcessorResponse> => {
  const queries = Array.isArray(params) ? params : [params]
  const stateTemplate: InitState = queries.reduce(
    (docIds, { date }) => ({ [date]: {}, ...docIds }),
    documents
  )
  return (load(stateTemplate) as Promise<RatesProcessorState>)
    .then(documents => ({ documents }))
    .catch(e => ({ error: serverError(params, e.message, 'db_error') }))
}

export const saveProcessor = (
  save: OmitFirstArg<DbSaveFunction>,
  _params: RateGetterParams | RateGetterParams[],
  documents: RatesProcessorState | {}
): RateProcessorResponse => {
  save(documents)
  return { documents }
}

export const slackProcessor = (
  slack: (text: string) => Promise<void>,
  error: ServerError
): ServerError => {
  if (error?.errorCode === 500) slack(error.message).catch(e => e)
  return error
}

const createLoadFunction = curry(loadCouchdbDocuments)
const createSaveFunction = curry(saveCouchdbDocuments)
const createSlackFunction = curry(slackPoster)
const createRateFunctions = (
  config: ServerConfig
): Array<OmitFirstArg<RateGetter>> =>
  rateGetters.map(getter => curry(getter)(config))

const createCleanerProcessor = curry(cleanerProcessor)
const createLoadProcessor = curry(loadProcessor)
const createSaveProcessor = curry(saveProcessor)
const createSlackProcessor = curry(slackProcessor)
const createRateProcessor = curry(rateProcessor)
const createRateProcessors = (
  funcs: Array<OmitFirstArg<RateGetter>>
): RateProcessor[] => funcs.map(func => createRateProcessor(func))

const createWaterfullProcessor = curry(processorWaterfall)

export const exchangeRateRouter = (
  serverConfig: ServerConfig
): express.Router => {
  const config = { ...serverConfig, exchanges: defaultProviders }
  const { dbFullpath, dbName } = config

  const router = express.Router()
  const localDB = promisify(nano(dbFullpath).db.use(dbName))

  const loadProcessor = createLoadProcessor(createLoadFunction({ localDB }))
  const saveProcessor = createSaveProcessor(createSaveFunction({ localDB }))
  const slackProcessor = createSlackProcessor(createSlackFunction(config))
  const rateProcessors = createRateProcessors(createRateFunctions(config))

  const [zeroRateProcessor, ...rest] = rateProcessors

  const exchangeRateCleaner = createCleanerProcessor(asRateGetterParams)
  const exchangeRateProcessor = createWaterfullProcessor([
    zeroRateProcessor,
    loadProcessor,
    ...rest,
    saveProcessor
  ])

  const exchangeRatesCleaner = createCleanerProcessor(asRatesGettersParams)
  const exchangeRatesProcessor = createWaterfullProcessor([
    zeroRateProcessor,
    loadProcessor,
    ...rest,
    saveProcessor
  ])

  router.get('/exchangeRate', (req, res, next) => {
    exchangeRateCleaner(req.query)
      .then(exchangeRateProcessor)
      .then(({ result, error }) =>
        result != null ? res.json(result) : Promise.reject(error)
      )
      .catch(e => next(slackProcessor(e)))
  })

  router.post('/exchangeRates', (req, res, next) => {
    exchangeRatesCleaner(req.body)
      .then(exchangeRatesProcessor)
      .then(({ result, error }) =>
        result != null ? res.json(result) : Promise.reject(error)
      )
      .catch(e => next(slackProcessor(e)))
  })

  return router
}
