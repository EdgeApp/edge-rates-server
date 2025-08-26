import { mul } from 'biggystring'
import { asArray, asMaybe, asObject, asOptional, asString } from 'cleaners'
import express from 'express'
import nano from 'nano'
import fetch from 'node-fetch'
import promisify from 'promisify-node'

import { config } from './config'
import { REDIS_COINRANK_KEY_PREFIX } from './constants'
import { asReturnGetRate, getExchangeRates } from './rates'
import {
  asCoinrankAssetReq,
  asCoinrankReq,
  asExchangeRateResponse,
  CoinrankAssetReq,
  CoinrankRedis,
  CoinrankReq
} from './types'
import { asExtendedReq } from './utils/asExtendedReq'
import {
  DbDoc,
  getAsync,
  hgetallAsync,
  hmgetAsync,
  setAsync
} from './utils/dbUtils'
import {
  addIso,
  fromCode,
  isIsoCode,
  logger,
  normalizeDate,
  subIso,
  toCode,
  toCurrencyPair,
  toIsoPair
} from './utils/utils'

const { defaultFiatCode } = config
const EXPIRE_TIME = 60000
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

  const thirtySecondsAgo = new Date(
    Date.now() - 30 * 1000 /* thirty seconds */
  ).toISOString()

  const out = asObject({
    currency_pair: asString,
    date: asMaybe(asString, thirtySecondsAgo)
  })(obj)

  out.date = normalizeDate(out.date)
  return out
}

const asExchangeRatesReq = asObject({
  data: asArray(asExchangeRateReq)
})

const asRatesRequest = asExtendedReq({
  requestedRates: asOptional(asExchangeRatesReq),
  requestedRatesResult: asOptional(asReturnGetRate)
})

// Hack to add type definitions for middleware
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
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

  if (exReq.requestedRates.data.every(pair => isIsoPair(pair.currency_pair))) {
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

// eslint-disable-next-line @typescript-eslint/no-misused-promises
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

// eslint-disable-next-line @typescript-eslint/no-misused-promises
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

const getRedisMarkets = async (
  fiatCode: string
): Promise<CoinrankRedis | undefined> => {
  const { ratesServerAddress } = config
  const now = new Date()
  const nowTimestamp = now.getTime()

  try {
    // First try to get data for the requested fiat code
    const jsonString = await getAsync(
      `${REDIS_COINRANK_KEY_PREFIX}_${fiatCode}`
    )

    // Only parse if jsonString is not null/undefined
    let redisResult: CoinrankRedis | undefined
    if (jsonString != null) {
      try {
        redisResult = JSON.parse(jsonString)

        // If we have valid data that hasn't expired, return it
        const lastUpdated =
          redisResult != null ? new Date(redisResult.lastUpdate).getTime() : 0
        if (nowTimestamp - lastUpdated <= EXPIRE_TIME) {
          return redisResult
        }
        // We have cached data but it's expired - we'll try to refresh it below
        // but will fall back to this expired data if refresh fails
      } catch (e) {
        // JSON parsing error, redisResult remains undefined
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        logger(`Error parsing Redis data for ${fiatCode}: ${e}`)
        // Continue to try to get fresh data
      }
    }

    // For USD requests, return the result immediately (could be undefined if not found)
    if (fiatCode === defaultFiatCode) {
      return redisResult
    }

    // If we need to convert from USD (either no data or expired data)
    try {
      // Get exchange rate
      const result = await fetch(
        `${ratesServerAddress}/v2/exchangeRate?currency_pair=${defaultFiatCode}_${fiatCode}`
      )
      if (!result.ok) {
        throw new Error(`Exchange rate API returned status ${result.status}`)
      }

      const resultJson = await result.json()
      const { exchangeRate } = asExchangeRateResponse(resultJson)
      const rate = Number(exchangeRate)

      // Validate the rate
      if (rate == null || isNaN(rate) || rate <= 0) {
        throw new Error(`Invalid exchange rate: ${exchangeRate}`)
      }

      // Get USD rankings
      const usdJsonString = await getAsync(
        `${REDIS_COINRANK_KEY_PREFIX}_${defaultFiatCode}`
      )
      if (usdJsonString == null) {
        throw new Error(`No USD data available in Redis`)
      }

      const usdRedisResult = JSON.parse(usdJsonString)
      const { markets } = usdRedisResult

      // Modify fiat-related fields with the forex rate
      const convertedMarkets = markets.map(m => ({
        ...m,
        marketCap: m.marketCap * rate,
        price: m.price * rate,
        volume24h: m.volume24h * rate,
        high24h: m.high24h * rate,
        low24h: m.low24h * rate,
        priceChange24h: m.priceChange24h * rate,
        marketCapChange24h: m.marketCapChange24h * rate,
        circulatingSupply: m.circulatingSupply * rate,
        totalSupply: m.totalSupply * rate,
        maxSupply: m.maxSupply * rate,
        allTimeHigh: m.allTimeHigh * rate,
        allTimeLow: m.allTimeLow * rate
      }))

      // Update redis cache
      const redisData: CoinrankRedis = {
        markets: convertedMarkets,
        lastUpdate: redisResult?.lastUpdate ?? now.toISOString()
      }
      await setAsync(
        `${REDIS_COINRANK_KEY_PREFIX}_${fiatCode}`,
        JSON.stringify(redisData)
      )

      return redisData
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger(`Error converting USD data to ${fiatCode}: ${e}`)
      // If conversion fails but we have cached data (even if expired), return that
      if (redisResult != null) {
        logger(`Falling back to cached data for ${fiatCode}`)
        return redisResult
      }
      // Only return undefined if we have no cached data at all
      return undefined
    }
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    logger(`Error in getRedisMarkets for ${fiatCode}: ${e}`)
    return undefined
  }
}

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const sendCoinrankList: express.RequestHandler = async (
  req,
  res,
  next
): Promise<void> => {
  const data = await hgetallAsync('coingecko')
  res.json({ data })
}

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const sendCoinrankAsset: express.RequestHandler = async (
  req,
  res,
  next
): Promise<void> => {
  const exReq = req as ExpressRequest
  if (exReq == null) return next(500)

  let query: CoinrankAssetReq
  try {
    query = asCoinrankAssetReq(req.query)
  } catch (e) {
    res
      .status(400)
      .send(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    return
  }
  const { fiatCode } = query
  const { assetId } = req.params

  try {
    const redisResult = await getRedisMarkets(fiatCode)

    if (redisResult == null) {
      res.status(400).send(`Unable to get results for fiatCode ${fiatCode}`)
      return
    }

    const { markets } = redisResult
    const market = markets.find(m => m.assetId === assetId)
    if (market == null) {
      res.status(404).send(`assetId ${assetId} not found`)
      return
    }

    res.json({ data: market })
  } catch (e) {
    const err: any = e
    res.status(500).send(err.message)
  }
}

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const sendCoinranks: express.RequestHandler = async (
  req,
  res,
  next
): Promise<void> => {
  const exReq = req as ExpressRequest
  if (exReq == null) return next(500)

  let query: CoinrankReq
  try {
    query = asCoinrankReq(req.query)
  } catch (e) {
    res
      .status(400)
      .send(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    return
  }
  const { fiatCode, start, length } = query

  try {
    if (start < 1 || start > 2000) {
      res
        .status(400)
        .send(`Invalid start param: ${start}. Must be between 1-2000`)
      return
    }
    if (length < 1 || length > 100) {
      res
        .status(400)
        .send(`Invalid length param: ${length}. Must be between 1-100`)
      return
    }
    const redisResult = await getRedisMarkets(fiatCode)

    if (redisResult == null) {
      res.status(400).send(`Unable to get results for fiatCode ${fiatCode}`)
      return
    }

    const { markets } = redisResult
    const data = markets.slice(start - 1, start + length)

    res.json({ data })
  } catch (e) {
    const err: any = e
    res.status(500).send(err.message)
  }
}

// *** ROUTES ***

export const exchangeRateRouterV1 = (): express.Router => {
  const router = express.Router()

  router.get('/exchangeRate', [
    exchangeRateCleaner,
    v1IsoChecker,
    v1ExchangeRateIsoAdder,
    queryRedis,
    queryExchangeRates,
    v1ExchangeRateIsoSubtractor,
    sendExchangeRate
  ])

  router.post('/exchangeRates', [
    exchangeRatesCleaner,
    v1IsoChecker,
    v1ExchangeRateIsoAdder,
    queryRedis,
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
    queryRedis,
    queryExchangeRates,
    sendExchangeRate
  ])

  router.post('/exchangeRates', [
    exchangeRatesCleaner,
    queryRedis,
    queryExchangeRates,
    sendExchangeRates
  ])

  router.get('/coinrank', [sendCoinranks])
  router.get('/coinrankAsset/:assetId', [sendCoinrankAsset])
  router.get('/coinrankList', [sendCoinrankList])

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
