import {
  ErrorType,
  RateError,
  RateGetterFull,
  RateParams,
  RatesDocument,
  ReturnGetRate
} from '../types'
import { inverseRate, logger } from '../utils'
import { getBridgedRate } from './currencyBridge'

const MINUTE = 60 * 1000

export const rateError = (
  rateParams: RateParams,
  message: string,
  errorType: ErrorType = 'db_error',
  errorCode: number = 500
): RateError => ({ message, errorCode, errorType, ...rateParams })

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

export const getDbBridgedRate: RateGetterFull = async (
  { bridgeCurrencies = [] },
  rateParams,
  currencyRates
) => {
  return getBridgedRate(
    {
      bridgeCurrencies,
      exchanges: [async () => Promise.resolve(null)]
    },
    rateParams,
    currencyRates
  )
}

export const getDbRate: RateGetterFull = async ({ localDb }, rateParams) => {
  const { currencyPair, date } = rateParams
  try {
    const ratesDocuments = await localDb.get(date)
    const dbRate = getDocumentRate(rateParams, ratesDocuments)

    return { document: ratesDocuments, ...dbRate }
  } catch (e) {
    if (e.error === 'not_found') {
      logger(`${currencyPair} does not exist for date: ${date}`)
      return {}
    } else {
      throw rateError(rateParams, e.message)
    }
  }
}

export const getZeroRate: RateGetterFull = (
  { zeroRateCurrencyCodes = {} },
  { currencyA, currencyB }
) =>
  zeroRateCurrencyCodes[currencyA] === true ||
  zeroRateCurrencyCodes[currencyB] === true
    ? { rate: '0' }
    : {}

export const getFallbackConstantRate: RateGetterFull = (
  { fallbackConstantRatePairs = {} },
  rateParams
) =>
  getDocumentRate(rateParams, {
    _id: rateParams.date,
    ...fallbackConstantRatePairs
  })

export const getExchangesRate: RateGetterFull = async (
  { exchanges = [] },
  rateParams,
  currencyRates
) => {
  if (exchanges.length === 0) return { document: currencyRates }

  try {
    const rate = await exchanges[0](rateParams)
    if (rate != null)
      return {
        rate,
        document: { ...currencyRates, [rateParams.currencyPair]: rate }
      }
  } catch (e) {}

  return getExchangesRate(
    { exchanges: exchanges.slice(1) },
    rateParams,
    currencyRates
  )
}

export const getExpiredRate: RateGetterFull = (
  { ratesLookbackLimit = MINUTE },
  { currencyPair, date },
  currencyRates
) => {
  if (Date.now() - ratesLookbackLimit > new Date(date).getTime()) {
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
