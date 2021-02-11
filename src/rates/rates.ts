import CONFIG from '../../serverConfig.json'
import { coincapHistorical } from '../providers/coincap'
import { coinMarketCapHistorical } from '../providers/coinMarketCap'
import { coinMarketCapCurrent } from '../providers/coinMarketCapBasic'
import { currencyConverter } from '../providers/currencyConverter'
import { RateParams, ReturnGetRate, ReturnRate } from '../types'
import { postToSlack } from '../utils'
import { currencyBridge } from './currencyBridge'
import {
  getFallbackConstantRate,
  getRateFromDB,
  getRateFromExchanges,
  getRateFromExchangesBridge,
  getRatesDocument,
  getZeroRate,
  rateError
} from './rateHelpers'

const defaultExchanges = [
  currencyConverter,
  coinMarketCapCurrent,
  coincapHistorical,
  coinMarketCapHistorical
]

const getRate = async (
  rateParams: RateParams,
  localDb: any,
  lookbackLimit = CONFIG.ratesLookbackLimit,
  exchanges = defaultExchanges
): Promise<ReturnGetRate> => {
  const { currencyA, currencyB, date } = rateParams
  const currencyPair = `${currencyA}_${currencyB}`

  const response = getZeroRate(rateParams)
  if (response != null) return response

  try {
    const response = await getRateFromDB(rateParams, localDb)
    if (response != null) return response
  } catch (e) {
    throw rateError(e.message, 500, 'db_error')
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

    const exchageBridgedRates = await getRateFromExchangesBridge(
      rateParams,
      exchageRates,
      exchanges
    )

    const exchangeBridgesRate = exchageBridgedRates[currencyPair]
    if (exchangeBridgesRate != null && exchangeBridgesRate !== '')
      return { rate: exchangeBridgesRate, document: exchageBridgedRates }

    // Use fallback hardcoded rates if lookups failed
    const response = getFallbackConstantRate(rateParams)
    if (response != null) return response

    const requestedDateTimestamp = new Date(date).getTime()
    if (Date.now() - lookbackLimit > requestedDateTimestamp) {
      exchageBridgedRates[currencyPair] = '0'
      return { document: exchageBridgedRates }
    }

    return {
      error: rateError(
        `RATES SERVER: All lookups failed to find exchange rate for currencypair ${currencyA}_${currencyB} at date ${date}.`,
        400,
        'not_found'
      )
    }
  } catch (e) {
    if (e.errorCode === 400) throw e
    throw rateError(e.message, 500, 'db_error')
  }
}

export const getExchangeRate = async (
  { currencyA, currencyB, date }: RateParams,
  localDb: any
): Promise<ReturnRate> => {
  try {
    const { rate, error, document } = await getRate(
      { currencyA, currencyB, date },
      localDb
    )

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
        `RATES SERVER: exchangeRate query failed for ${currencyA}_${currencyB} with error code ${e.errorCode}.  ${e.message}`
      ).catch(e)
    }
    return { error: e }
  }
}
