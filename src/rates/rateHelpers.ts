import CONFIG from '../../serverConfig.json'
import {
  ErrorType,
  ProviderFetch,
  RateError,
  RateParams,
  RatesDocument,
  ReturnGetRate
} from '../types'
import { inverseRate, logger } from '../utils'

const {
  ratesLookbackLimit,
  zeroRateCurrencyCodes,
  fallbackConstantRatePairs
} = CONFIG

export const rateError = (
  rateParams: RateParams,
  message: string,
  errorType: ErrorType = 'db_error',
  errorCode: number = 500
): RateError => ({ message, errorCode, errorType, ...rateParams })

export const getDbRate = async (
  rateParams: RateParams,
  localDb: any
): Promise<ReturnGetRate> => {
  const { currencyPair, date } = rateParams
  try {
    const ratesDocuments = await localDb.get(date)
    const rate = getDocumentRate(rateParams, ratesDocuments)
    return { document: ratesDocuments, ...rate }
  } catch (e) {
    if (e.error === 'not_found') {
      logger(`${currencyPair} does not exist for date: ${date}`)
      return { document: { _id: date } }
    } else {
      throw rateError(rateParams, e.message)
    }
  }
}

export const getZeroRate = (
  { currencyA, currencyB }: RateParams,
  zeroRates = zeroRateCurrencyCodes
): ReturnGetRate =>
  zeroRates[currencyA] === true || zeroRates[currencyB] === true
    ? { rate: '0' }
    : {}

export const getFallbackConstantRate = (
  rateParams: RateParams
): ReturnGetRate =>
  getDocumentRate(rateParams, {
    _id: rateParams.date,
    ...fallbackConstantRatePairs
  })

export const getDocumentRate = (
  { currencyA, currencyB, currencyPair }: RateParams,
  currencyRates: RatesDocument
): ReturnGetRate => {
  if (currencyRates[currencyPair] != null)
    return {
      rate: currencyRates[currencyPair]
    }

  const inversePair = `${currencyB}_${currencyA}`
  if (currencyRates[inversePair] != null) {
    return {
      rate: inverseRate(currencyRates[inversePair])
    }
  }
  return {}
}

export const getExchangesRate = async (
  rateParams: RateParams,
  currencyRates: RatesDocument = { _id: rateParams.date },
  exchanges: ProviderFetch[]
): Promise<ReturnGetRate> => {
  if (exchanges.length === 0) return { document: currencyRates }

  try {
    const rate = await exchanges[0](rateParams)
    if (rate != null)
      return {
        rate,
        document: { ...currencyRates, [rateParams.currencyPair]: rate }
      }
  } catch (e) {}

  return getExchangesRate(rateParams, currencyRates, exchanges.slice(1))
}

export const getExpiredRate = (
  { currencyPair, date }: RateParams,
  currencyRates: RatesDocument = { _id: date },
  lookbackLimit = ratesLookbackLimit
): ReturnGetRate => {
  if (Date.now() - lookbackLimit > new Date(date).getTime()) {
    return {
      rate: '0',
      document: {
        ...currencyRates,
        [currencyPair]: '0'
      }
    }
  }
  return {}
}
