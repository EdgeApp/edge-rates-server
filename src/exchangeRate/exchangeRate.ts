// import { Cleaner } from 'cleaners'
import express from 'express'
import nano from 'nano'
import promisify from 'promisify-node'

import { defaultProviders } from '../providers/providers'
import { asRateParams, asRatesParams } from '../types/cleaners'
import { ServerConfig, ServerError } from '../types/types'
import { loadFromCouch, saveToCouch } from '../utils/dbUtils'
import {
  fromCleaner,
  fromLoad,
  fromSave,
  toWaterfall
} from '../utils/processor'
import { slackPoster } from '../utils/slack'
import { compose, curry } from '../utils/utils'
import { getBridgedRate } from './rateProcessor'

const rateGetters = [getBridgedRate]

export const slackProcessor = (
  slack: (text: string) => Promise<void>,
  error: ServerError
): ServerError => {
  if (error?.errorCode === 500) slack(error.message).catch(e => e)
  return error
}

const createWaterfullProcessor = curry(toWaterfall)
const exchangeRateCleaner = curry(fromCleaner)(asRateParams)
const exchangeRatesCleaner = curry(fromCleaner)(asRatesParams)
const createLoadProcessor = compose(curry(fromLoad), curry(loadFromCouch))
const createSaveProcessor = compose(curry(fromSave), curry(saveToCouch))
const createSlackProcessor = compose(curry(slackProcessor), curry(slackPoster))
const createRateProcessors = rateGetters.map((getter: RateGetter) =>
  compose(curry(getter), curry(rateProcessor))
)

export const exchangeRateRouter = (
  serverConfig: ServerConfig
): express.Router => {
  const config = { ...serverConfig, exchanges: defaultProviders }
  const { dbFullpath, dbName } = config

  const router = express.Router()
  const localDB = promisify(nano(dbFullpath).db.use(dbName))

  const loadProcessor = createLoadProcessor({ localDB })
  const saveProcessor = createSaveProcessor({ localDB })
  const slackProcessor = createSlackProcessor(config)
  const rateProcessors = createRateProcessors.map(processor =>
    processor(config as any)
  )

  const [zeroRateProcessor, ...rest] = rateProcessors

  const exchangeRateProcessor = createWaterfullProcessor([
    createWaterfullProcessor([zeroRateProcessor, loadProcessor, ...rest]),
    saveProcessor
  ])

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
