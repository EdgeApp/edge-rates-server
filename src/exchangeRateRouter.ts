import { asArray, asObject, asOptional, asString } from 'cleaners'
import express from 'express'
import nano from 'nano'
import promisify from 'promisify-node'

import { config } from './config'
import { getExchangeRates } from './rates'
import { DbDoc } from './utils/dbUtils'
import {
  addIso,
  fromCode,
  isIsoCode,
  subIso,
  toCode,
  toCurrencyPair,
  toIsoPair
} from './utils/utils'

export const asExchangeRateReq = asObject({
  currency_pair: asString,
  date: asOptional(asString)
})

const asExchangeRatesReq = asObject({
  data: asArray(asExchangeRateReq)
})

export type ExchangeRateReq = ReturnType<typeof asExchangeRateReq>

const { couchUri, fiatCurrencyCodes: FIAT_CODES } = config
const EXCHANGE_RATES_BATCH_LIMIT = 100

const nanoDb = nano(couchUri)
const dbRates: nano.DocumentScope<DbDoc> = nanoDb.db.use('db_rates')
promisify(dbRates)

// *** UTILS ***

const addIsoToMaybeFiatCode = (code: string): string =>
  FIAT_CODES.includes(addIso(code)) ? addIso(code) : code

const maybeAddIsoToPair = (pair: string): string =>
  toCurrencyPair(
    addIsoToMaybeFiatCode(fromCode(pair)),
    addIsoToMaybeFiatCode(toCode(pair))
  )

const removeIsoFromPair = (pair: string): string =>
  toIsoPair(subIso, subIso)(fromCode(pair), toCode(pair))

const isIsoPair = (pair: string): boolean =>
  isIsoCode(fromCode(pair)) || isIsoCode(toCode(pair))

// *** MIDDLEWARE ***

const v1ExchangeRateIsoAdder = (req: any, res: any, next: Function): void => {
  req.requestedRates.data = req.requestedRates.data.map(req => ({
    currency_pair: maybeAddIsoToPair(req.currency_pair),
    date: req.date
  }))
  next()
}

const v1ExchangeRateIsoSubtractor = (
  req: any,
  res: any,
  next: Function
): void => {
  req.requestedRatesResult.data = req.requestedRatesResult.data.map(rate => ({
    currency_pair: removeIsoFromPair(rate.currency_pair),
    date: rate.date,
    exchangeRate: rate.exchangeRate,
    error: rate.error
  }))
  next()
}

const v1IsoChecker = (req: any, res: any, next: Function): void => {
  if (
    req.requestedRates.data.every(pair => !isIsoPair(pair.currency_pair)) !==
    true
  ) {
    return res
      .status(400)
      .send(`Please use v2 of this API to query with ISO codes`)
  }
  next()
}

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
  try {
    req.requestedRatesResult = await getExchangeRates(
      req.requestedRates.data,
      dbRates
    )
  } catch (e) {
    res.status(400).send(e instanceof Error ? e.message : 'Malformed request')
  }
  next()
}

const sendExchangeRate = (req: any, res: any): void => {
  res.json(req.requestedRatesResult.data[0])
}

const sendExchangeRates = (req: any, res: any): void => {
  res.json({ data: req.requestedRatesResult.data })
}

// *** ROUTES ***

export const exchangeRateRouterV1 = (): express.Router => {
  const router = express.Router()

  router.get('/exchangeRate', [
    exchangeRateCleaner,
    v1IsoChecker,
    v1ExchangeRateIsoAdder,
    queryExchangeRates,
    v1ExchangeRateIsoSubtractor,
    sendExchangeRate
  ])

  router.post('/exchangeRates', [
    exchangeRatesCleaner,
    v1IsoChecker,
    v1ExchangeRateIsoAdder,
    queryExchangeRates,
    v1ExchangeRateIsoSubtractor,
    sendExchangeRates
  ])

  return router
}

export const exchangeRateRouterV2 = (): express.Router => {
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
