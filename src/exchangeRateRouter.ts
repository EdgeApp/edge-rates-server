import { asArray, asObject, asOptional, asString } from 'cleaners'
import express from 'express'
import nano from 'nano'
import promisify from 'promisify-node'

import { config } from './config'
import { getExchangeRates } from './rates'
import { DbDoc } from './utils/dbUtils'

export const asExchangeRateReq = asObject({
  currency_pair: asString,
  date: asOptional(asString)
})

const asExchangeRatesReq = asObject({
  data: asArray(asExchangeRateReq)
})

export type ExchangeRateReq = ReturnType<typeof asExchangeRateReq>

const EXCHANGE_RATES_BATCH_LIMIT = 100

const nanoDb = nano(config.couchUri)
const dbRates: nano.DocumentScope<DbDoc> = nanoDb.db.use('db_rates')
promisify(dbRates)

// *** MIDDLEWARE ***

// Query params:
//  currency_pair: String with the two currencies separated by an underscore. Ex: "ETH_iso:USD"
//  date: String (optional) ex. "2019-11-21T15:28:21.123Z"

const exchangeRateCleaner = (req: any, res: any, next: Function): void => {
  const { currencyPair, date } = req.query
  try {
    req.requestedRates = asExchangeRatesReq({
      data: [{ currency_pair: currencyPair, date }]
    })
  } catch (e) {
    return res.status(400).send(`Missing Request fields.`)
  }
  next()
}

//  Query body:
//  { data: [{ currency_pair: string, date? string) }] }

const exchangeRatesCleaner = (req: any, res: any, next: Function): void => {
  try {
    req.requestedRates = asExchangeRatesReq(req.body)
  } catch (e) {
    return res.status(400).send(`Missing Request fields.`)
  }
  if (req.requestedRates.data.length > EXCHANGE_RATES_BATCH_LIMIT) {
    return res
      .status(400)
      .send(`Exceeded Limit of ${EXCHANGE_RATES_BATCH_LIMIT}`)
  }
  next()
}

const queryExchangeRates = async (
  req: any,
  res: any,
  next: Function
): Promise<void> => {
  req.requestedRatesResult = await getExchangeRates(
    req.requestedRates.data,
    dbRates
  )
  next()
}

const sendExchangeRate = (req: any, res: any): void => {
  res.json(req.requestedRatesResult.data[0])
}

const sendExchangeRates = (req: any, res: any): void => {
  res.json({ data: req.requestedRatesResult.data })
}

// *** ROUTES ***

export const exchangeRateRouter = (): express.Router => {
  const router = express.Router()

  router.get('/exchangeRate', [
    exchangeRateCleaner,
    queryExchangeRates,
    sendExchangeRate
  ])

  router.post('/exchangeRates', [
    exchangeRatesCleaner,
    queryExchangeRates,
    sendExchangeRates
  ])

  return router
}
