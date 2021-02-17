import { defaultProviders } from '../providers/providers'
import { RateParams, ReturnGetRate, ReturnGetRates } from '../types'
import { logger, SlackPoster } from '../utils'
import { currencyBridge } from './currencyBridge'
import {
  getDbRate,
  getExchangesRate,
  getExpiredRate,
  getFallbackConstantRate,
  getZeroRate,
  rateError
} from './rateHelpers'

const postToSlack = SlackPoster()

export const getRate = async (
  rateParams: RateParams,
  localDb: any,
  exchanges = defaultProviders
): Promise<ReturnGetRate> => {
  const { currencyPair } = rateParams

  try {
    // Check if one of the currency is a zero rate currency.
    const zeroRate = getZeroRate(rateParams)
    if (zeroRate.rate != null) return zeroRate

    // Get all the currency rates for the requested date from the db.
    // Try to get the currencyPair or the inverted currencyPair rate.
    const dbRates = await getDbRate(rateParams, localDb)
    if (dbRates.rate != null) return zeroRate

    // Try to get the rate from the document using bridged currencies.
    const dbBridgedRates = await currencyBridge(rateParams, dbRates.document)
    if (dbBridgedRates.rate != null) return dbBridgedRates

    // Try to get the rate from any of the exchanges.
    const exchangeRate = await getExchangesRate(
      rateParams,
      dbBridgedRates.document,
      exchanges
    )
    if (exchangeRate.rate != null) return exchangeRate

    // Try to get the rate from any of the exchanges using bridged currencies.
    const exchageBridgedRates = await currencyBridge(
      rateParams,
      dbBridgedRates.document,
      exchanges
    )
    const exchangeBridgesRate = exchageBridgedRates[currencyPair]
    if (exchangeBridgesRate.rate != null) return exchangeBridgesRate

    // Check if the currencyPair or the inverted has a default rate value.
    const fallbackRate = getFallbackConstantRate(rateParams)
    if (fallbackRate.rate != null) return fallbackRate

    const expiredRate = getExpiredRate(rateParams, fallbackRate.document)
    if (expiredRate.rate != null) return expiredRate

    // If no rate was found, return a rateError error.
    return {
      error: rateError(
        rateParams,
        'All lookups failed to find exchange rate for this query',
        'not_found',
        400
      )
    }
  } catch (e) {
    // Notify slack about critical errors with the database (like db is down).
    if (e.errorType === 'db_error') {
      postToSlack(
        new Date().toISOString(),
        `RATES SERVER: exchangeRate query failed for ${currencyPair} with error code ${e.errorCode}.  ${e.message}`
      ).catch(e)
    }
    // Convert the error to rateError in case it's not one already.
    return {
      error: e.errorCode != null ? e : rateError(rateParams, e.message)
    }
  }
}

export const getRates = async (
  ratesQuery: RateParams[],
  localDb
): Promise<ReturnGetRates> => {
  const returnedRates: Array<Promise<
    ReturnGetRate & RateParams
  >> = ratesQuery.map(async rateParams => {
    const rateResponse = await getRate(rateParams, localDb)
    return { ...rateParams, ...rateResponse }
  })

  const allRates = await Promise.all(returnedRates)

  return allRates.reduce(
    (
      result: ReturnGetRates,
      rateData: ReturnGetRate & RateParams
    ): ReturnGetRates => {
      const { documents, results } = result
      const { rate, date, error, currencyPair, document } = rateData
      if (document != null) {
        const { _id } = document
        documents[_id] =
          documents[_id] == null ? document : { ...documents[_id], ...document }
      }

      if (error != null) {
        logger(error)
        results.push({ currencyPair, date, error })
      } else {
        results.push({ currencyPair, date, exchangeRate: rate })
      }
      return { documents, results }
    },
    { documents: {}, results: [] }
  )
}
