import CONFIG from '../../serverConfig.json'
import { defaultProviders } from '../providers/providers'
import { RateParams, ReturnGetRate, ReturnRate } from '../types'
import { postToSlack } from '../utils'
import { currencyBridge } from './currencyBridge'
import {
  getFallbackConstantRate,
  getRateFromDB,
  getRateFromExchanges,
  getRatesDocument,
  getZeroRate,
  rateError
} from './rateHelpers'

const getRate = async (
  rateParams: RateParams,
  localDb: any,
  lookbackLimit = CONFIG.ratesLookbackLimit,
  exchanges = defaultProviders
): Promise<ReturnGetRate> => {
  const { currencyPair, date } = rateParams

  const zeroRates = getZeroRate(rateParams)
  const zeroRate = zeroRates[currencyPair]
  if (zeroRate != null && zeroRate !== '') return { rate: zeroRate }

  try {
    const dbRates = await getRateFromDB(rateParams, localDb)
    const dbRate = dbRates[currencyPair]
    if (dbRate != null && dbRate !== '') return { rate: dbRate }
  } catch (e) {
    throw rateError(rateParams, e.message)
  }

  try {
    const dbRates = await getRatesDocument(rateParams, localDb)

    const dbBridgedRates = await currencyBridge(rateParams, dbRates, async () =>
      Promise.resolve('')
    )
    const bridgeRate = dbBridgedRates[currencyPair]
    if (bridgeRate != null && bridgeRate !== '')
      return { rate: bridgeRate, document: dbBridgedRates }

    const exchageRates = await getRateFromExchanges(
      rateParams,
      dbBridgedRates,
      exchanges
    )
    const exchangeRate = exchageRates[currencyPair]
    if (exchangeRate != null && exchangeRate !== '')
      return { rate: exchangeRate, document: exchageRates }

    const exchageBridgedRates = await currencyBridge(
      rateParams,
      exchageRates,
      exchanges
    )
    const exchangeBridgesRate = exchageBridgedRates[currencyPair]
    if (exchangeBridgesRate != null && exchangeBridgesRate !== '')
      return { rate: exchangeBridgesRate, document: exchageBridgedRates }

    // Use fallback hardcoded rates if lookups failed
    const fallbackRates = getFallbackConstantRate(rateParams)
    const fallbackRate = fallbackRates[currencyPair]
    if (fallbackRate != null && fallbackRate !== '')
      return { rate: fallbackRate }

    const requestedDateTimestamp = new Date(date).getTime()
    if (Date.now() - lookbackLimit > requestedDateTimestamp) {
      exchageBridgedRates[currencyPair] = '0'
      return { document: exchageBridgedRates }
    }

    return {
      error: rateError(
        rateParams,
        'RATES SERVER: All lookups failed to find exchange rate for this query',
        'not_found',
        400
      )
    }
  } catch (e) {
    if (e.errorCode === 400) throw e
    throw rateError(rateParams, e.message)
  }
}

export const getExchangeRate = async (
  rateParams: RateParams,
  localDb: any
): Promise<ReturnRate> => {
  const { date, currencyPair } = rateParams
  try {
    const { rate, error, document } = await getRate(rateParams, localDb)

    return {
      data: {
        date,
        exchangeRate: rate
      },
      error,
      document
    }
  } catch (e) {
    if (e.errorType === 'db_error') {
      postToSlack(
        new Date().toISOString(),
        `RATES SERVER: exchangeRate query failed for ${currencyPair} with error code ${e.errorCode}.  ${e.message}`
      ).catch(e)
    }
    return { error: e }
  }
}
