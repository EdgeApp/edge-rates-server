import { asArray, asMaybe, asObject, asOptional, asString } from 'cleaners'
import express from 'express'
import nano from 'nano'
import promisify from 'promisify-node'

import { config } from './config'
import { asReturnGetRate, getExchangeRates } from './rates'
import { uidEngine } from './uidEngine'
import { asExtendedReq } from './utils/asExtendedReq'
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

const asRatesRequest = asExtendedReq({
  requestedRates: asOptional(asExchangeRatesReq),
  requestedRatesResult: asOptional(asReturnGetRate)
})

export type ExchangeRateReq = ReturnType<typeof asExchangeRateReq>
export type ExchangeRatesReq = ReturnType<typeof asExchangeRatesReq>

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

const v1ExchangeRateIsoAdder: express.RequestHandler = (
  req,
  res,
  next
): void => {
  const exReq = asMaybe(asRatesRequest)(req)
  if (exReq?.requestedRates == null) return next(500)

  exReq.requestedRates.data = exReq.requestedRates.data.map(req => ({
    currency_pair: maybeAddIsoToPair(req.currency_pair),
    date: req.date
  }))

  next()
}

const v1ExchangeRateIsoSubtractor: express.RequestHandler = (
  req,
  res,
  next
): void => {
  const exReq = asMaybe(asRatesRequest)(req)
  if (exReq?.requestedRatesResult == null) return next(500)

  exReq.requestedRatesResult.data = exReq.requestedRatesResult.data.map(
    rate => ({
      ...rate,
      currency_pair: removeIsoFromPair(rate.currency_pair)
    })
  )

  next()
}

const v1IsoChecker: express.RequestHandler = (req, res, next): void => {
  const exReq = asMaybe(asRatesRequest)(req)
  if (exReq?.requestedRates == null) return next(500)

  if (
    exReq.requestedRates.data.every(pair => isIsoPair(pair.currency_pair)) ===
    true
  ) {
    res.status(400).send(`Please use v2 of this API to query with ISO codes`)
    return
  }

  next()
}

// Query params:
//  currency_pair: String with the two currencies separated by an underscore. Ex: "ETH_iso:USD"
//  date: String (optional) ex. "2019-11-21T15:28:21.123Z"

const exchangeRateCleaner: express.RequestHandler = (req, res, next): void => {
  const exReq = asMaybe(asRatesRequest)(req)
  if (exReq == null) return next(500)

  const { currencyPair, date } = req.query
  try {
    exReq.requestedRates = asExchangeRatesReq({
      data: [{ currency_pair: currencyPair, date }]
    })
  } catch (e) {
    res.status(400).send(`Missing Request fields.`)
    return
  }

  next()
}

//  Query body:
//  { data: [{ currency_pair: string, date? string) }] }

const exchangeRatesCleaner: express.RequestHandler = (req, res, next): void => {
  const exReq = asRatesRequest(req)
  if (exReq == null) return next(500)

  try {
    exReq.requestedRates = asExchangeRatesReq(exReq.body)
  } catch (e) {
    res.status(400).send(`Missing Request fields.`)
    return
  }
  if (exReq.requestedRates.data.length > EXCHANGE_RATES_BATCH_LIMIT) {
    res.status(400).send(`Exceeded Limit of ${EXCHANGE_RATES_BATCH_LIMIT}`)
    return
  }

  //
  next()
}

const queryExchangeRates: express.RequestHandler = async (
  req,
  res,
  next
): Promise<void> => {
  const exReq = asMaybe(asRatesRequest)(req)
  if (exReq?.requestedRates == null) return next(500)

  try {
    exReq.requestedRatesResult = await getExchangeRates(
      exReq.requestedRates.data,
      dbRates
    )
  } catch (e) {
    res.status(400).send(e instanceof Error ? e.message : 'Malformed request')
  }

  //
  next()
}

const updateUidCache: express.RequestHandler = async (
  req,
  res,
  next
): Promise<void> => {
  const cacheControl = req.get('Cache-Control')
  if (cacheControl === 'no-cache') {
    await uidEngine()
  }

  next()
}

const sendExchangeRate: express.RequestHandler = (req, res, next): void => {
  const exReq = asMaybe(asRatesRequest)(req)
  if (exReq?.requestedRatesResult == null) return next(500)

  res.json(exReq.requestedRatesResult.data[0])
}

const sendExchangeRates: express.RequestHandler = (req, res, next): void => {
  const exReq = asMaybe(asRatesRequest)(req)
  if (exReq?.requestedRatesResult == null) return next(500)

  res.json({ data: exReq.requestedRatesResult.data })
}

// *** ROUTES ***

export const exchangeRateRouterV1 = (): express.Router => {
  const router = express.Router()

  router.get('/exchangeRate', [
    exchangeRateCleaner,
    v1IsoChecker,
    v1ExchangeRateIsoAdder,
    queryExchangeRates,
    updateUidCache,
    v1ExchangeRateIsoSubtractor,
    sendExchangeRate
  ])

  router.post('/exchangeRates', [
    exchangeRatesCleaner,
    v1IsoChecker,
    v1ExchangeRateIsoAdder,
    queryExchangeRates,
    updateUidCache,
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
    updateUidCache,
    sendExchangeRate
  ])

  router.post('/exchangeRates', [
    exchangeRatesCleaner,
    queryExchangeRates,
    updateUidCache,
    sendExchangeRates
  ])

  return router
}
