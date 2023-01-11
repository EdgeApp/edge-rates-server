import { mul } from 'biggystring'
import { asArray, asMaybe, asObject, asOptional, asString } from 'cleaners'
import express from 'express'
import nano from 'nano'
import promisify from 'promisify-node'

import { config } from './config'
import {
  fallbackConstantRates,
  zeroRates
} from './providers/hardcodedProviders'
import {
  asReturnGetRate,
  AssetMap,
  getExchangeRates,
  NewRates,
  ReturnRate
} from './rates'
import { hgetallAsync, hmgetAsync } from './uidEngine'
import { asExtendedReq } from './utils/asExtendedReq'
import currencyCodeMaps from './utils/currencyCodeMaps.json'
import { DbDoc } from './utils/dbUtils'
import {
  addIso,
  fromCode,
  isIsoCode,
  normalizeDate,
  subIso,
  toCode,
  toCurrencyPair,
  toIsoPair
} from './utils/utils'

export interface ExchangeRateReq {
  currency_pair: string
  date: string
}

export const asExchangeRateReq = (obj): ExchangeRateReq => {
  const { currency_pair, date } = obj

  if (
    typeof currency_pair !== 'string' ||
    (date != null && typeof date !== 'string')
  )
    throw new Error(
      'Missing or invalid query param(s). currency_pair and date should both be strings'
    )

  if (currency_pair.split('_').length !== 2)
    throw new Error(
      'currency_pair query param malformed. Should be [curA]_[curB], ex: "ETH_iso:USD"'
    )

  if (date != null) {
    const timestamp = Date.parse(date)
    if (isNaN(timestamp))
      throw new Error(
        'date query param malformed.  Should be conventional date string, ex:"2019-11-21T15:28:21.123Z"'
      )
    if (timestamp > Date.now()) {
      throw new Error('Future date received. Must send past date.')
    }
  }

  const thirtySecondsAgo = normalizeDate(
    new Date().toISOString(),
    30 * 1000 /* thirty seconds */
  )
  return asObject({
    currency_pair: asString,
    date: asMaybe(asString, thirtySecondsAgo)
  })(obj)
}

const asExchangeRatesReq = asObject({
  data: asArray(asExchangeRateReq)
})

const asRatesRequest = asExtendedReq({
  requestedRates: asOptional(asExchangeRatesReq),
  requestedRatesResult: asOptional(asReturnGetRate)
})

// Hack to add type definitions for middleware
type ExpressRequest = ReturnType<typeof asRatesRequest> | void

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
  const exReq = req as ExpressRequest
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
  const exReq = req as ExpressRequest
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
  const exReq = req as ExpressRequest
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
  const exReq = req as ExpressRequest
  if (exReq == null) return next(500)

  const { currency_pair, date } = req.query
  try {
    exReq.requestedRates = asExchangeRatesReq({
      data: [{ currency_pair, date }]
    })
  } catch (e) {
    res
      .status(400)
      .send(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    return
  }

  next()
}

//  Query body:
//  { data: [{ currency_pair: string, date? string) }] }

const exchangeRatesCleaner: express.RequestHandler = (req, res, next): void => {
  const exReq = req as ExpressRequest
  if (exReq == null) return next(500)

  try {
    exReq.requestedRates = asExchangeRatesReq(exReq.body)
  } catch (e) {
    res
      .status(400)
      .send(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    return
  }
  if (exReq.requestedRates.data.length > EXCHANGE_RATES_BATCH_LIMIT) {
    res.status(400).send(`Exceeded Limit of ${EXCHANGE_RATES_BATCH_LIMIT}`)
    return
  }

  next()
}

const queryRedis: express.RequestHandler = async (
  req,
  res,
  next
): Promise<void> => {
  const exReq = req as ExpressRequest
  if (exReq?.requestedRates == null) return next(500)

  // Redis will store all crypto code rates in USD and USD to all fiat codes
  // This middleware splits up incoming pairs into two rates, crypto_USD and USD_fiat,
  // so each unique timestamp only requires a single query to redis to get all applicable rates.

  const reqMap: { [date: string]: string[] } = {}
  for (const req of exReq.requestedRates.data) {
    const [cryptoCode, fiatCode] = req.currency_pair.split('_')
    if (reqMap[req.date] == null) reqMap[req.date] = []
    reqMap[req.date].push(
      req.currency_pair,
      `${cryptoCode}_iso:USD`,
      `iso:USD_${fiatCode}`
    )
  }

  // Initialize requestedRatesResult object to collect found rates
  exReq.requestedRatesResult = { data: [], documents: [] }

  // Initialize bucket of pairs still not found
  const stillNeeded: ExchangeRateReq[] = []

  for (const date of Object.keys(reqMap)) {
    const usdRates = await hmgetAsync(date, reqMap[date])
    for (let i = 0; i < usdRates.length; i++) {
      if (i % 3 !== 0) continue
      const pair = {
        currency_pair: reqMap[date][i],
        date
      }

      // Test if we found the exact request
      if (usdRates[i] != null) {
        exReq.requestedRatesResult.data.push({
          ...pair,
          exchangeRate: usdRates[i]
        })
        continue
      }

      // Test if we can bridge the rate using USD
      const cryptoUSD = usdRates[i + 1]
      const fiatUSD = usdRates[i + 2]
      if (cryptoUSD == null || fiatUSD == null) {
        stillNeeded.push(pair)
      } else {
        exReq.requestedRatesResult.data.push({
          ...pair,
          exchangeRate: mul(cryptoUSD, fiatUSD)
        })
      }
    }
  }
  exReq.requestedRates.data = [...stillNeeded]

  next()
}

const queryExchangeRates: express.RequestHandler = async (
  req,
  res,
  next
): Promise<void> => {
  const exReq = req as ExpressRequest
  if (exReq?.requestedRates == null) return next(500)

  if (exReq.requestedRates.data.length === 0) {
    return next()
  }

  try {
    const queriedRates = await getExchangeRates(
      exReq.requestedRates.data,
      dbRates
    )
    exReq.requestedRatesResult = {
      data: [...(exReq.requestedRatesResult?.data ?? []), ...queriedRates.data],
      documents: [...queriedRates.documents] // TODO: Change data type since the douch docs aren't needed after this
    }
  } catch (e) {
    res.status(500).send('Server error')
  }

  next()
}

const sendExchangeRate: express.RequestHandler = (req, res, next): void => {
  const exReq = req as ExpressRequest
  if (exReq?.requestedRatesResult == null) return next(500)

  res.json(exReq.requestedRatesResult.data[0])
}

const sendExchangeRates: express.RequestHandler = (req, res, next): void => {
  const exReq = req as ExpressRequest
  if (exReq?.requestedRatesResult == null) return next(500)

  res.json({ data: exReq.requestedRatesResult.data })
}

/**
 * Produces an Express request handler to be used as a middleware. The
 * handler will get rates from the provider and store them in
 * `req.requestedRatesResult.data`.
 *
 * @remarks
 * Currenlty, this function is used to query rates from
 * {@link zeroRates} and {@link fallbackConstantRates} providers. The
 * returned middleware for `zeroRates` will be used before
 * {@link queryRedis} and `fallbackConstantRates` after
 * {@link queryExchangeRates} so that
 * the rates won't be stored in redis and couchdb.
 *
 * @param provider The provider function that will return a NewRates
 * object
 * @returns An Express request handler to be used as a middleware.
 */
const queryRatesFromProvder = (
  provider: (
    rateObj: ReturnRate[],
    currentTime: string,
    assetMap: AssetMap
  ) => NewRates
): express.RequestHandler => async (req, res, next): Promise<void> => {
  const rateReq = req as ExpressRequest
  if (rateReq?.requestedRatesResult == null) return next(500)

  const currentTime = normalizeDate(new Date().toISOString())
  if (typeof currentTime !== 'string') throw new Error('malformed date')

  let constantCurrencyCodes = await hgetallAsync('constantCurrencyCodes')
  if (constantCurrencyCodes == null)
    constantCurrencyCodes = JSON.parse(currencyCodeMaps.toString())

  const result = provider(
    rateReq.requestedRatesResult?.data ?? [],
    currentTime,
    constantCurrencyCodes
  )

  for (const date of Object.keys(result)) {
    const pairs = result[date]
    for (const pair of Object.keys(pairs)) {
      rateReq.requestedRatesResult.data.push({
        currency_pair: pair,
        date,
        exchangeRate: pairs[pair]
      })
    }
  }
  next()
}

// *** ROUTES ***

export const exchangeRateRouterV1 = (): express.Router => {
  const router = express.Router()

  router.get('/exchangeRate', [
    exchangeRateCleaner,
    v1IsoChecker,
    v1ExchangeRateIsoAdder,
    queryRatesFromProvder(zeroRates),
    queryRedis,
    queryExchangeRates,
    queryRatesFromProvder(fallbackConstantRates),
    v1ExchangeRateIsoSubtractor,
    sendExchangeRate
  ])

  router.post('/exchangeRates', [
    exchangeRatesCleaner,
    v1IsoChecker,
    v1ExchangeRateIsoAdder,
    queryRatesFromProvder(zeroRates),
    queryRedis,
    queryExchangeRates,
    queryRatesFromProvder(fallbackConstantRates),
    v1ExchangeRateIsoSubtractor,
    sendExchangeRates
  ])

  return router
}

export const exchangeRateRouterV2 = (): express.Router => {
  const router = express.Router()

  router.get('/exchangeRate', [
    exchangeRateCleaner,
    queryRatesFromProvder(zeroRates),
    queryRedis,
    queryExchangeRates,
    queryRatesFromProvder(fallbackConstantRates),
    sendExchangeRate
  ])

  router.post('/exchangeRates', [
    exchangeRatesCleaner,
    queryRatesFromProvder(zeroRates),
    queryRedis,
    queryExchangeRates,
    queryRatesFromProvder(fallbackConstantRates),
    sendExchangeRates
  ])

  return router
}

export const heartbeat = (): express.Router => {
  const router = express.Router()

  router.get('/', [
    (req, res, next) => {
      req.query = { currency_pair: 'BTC_iso:USD' }
      next()
    },
    exchangeRateCleaner,
    queryRedis,
    queryExchangeRates,
    sendExchangeRate
  ])

  return router
}
