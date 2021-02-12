import CONFIG from '../../serverConfig.json'
import { coinFromDb } from '../providers/coinFromDb'
import {
  ErrorType,
  ProviderFetch,
  RateError,
  RateParams,
  RatesDocument
} from '../types'
import { log } from '../utils'

const { zeroRateCurrencyCodes, fallbackConstantRatePairs } = CONFIG

export const rateError = (
  message: string,
  errorCode: number = 500,
  errorType?: ErrorType
): RateError => Object.assign(new Error(message), { errorCode, errorType })

export const getZeroRate = (
  { currencyA, currencyB, currencyPair, date }: RateParams,
  zeroRates = zeroRateCurrencyCodes
): RatesDocument => {
  const result = { _id: date }

  if (zeroRates[currencyA] === true || zeroRates[currencyB] === true)
    return { ...result, [currencyPair]: '0' }

  return result
}

export const getFallbackConstantRate = (
  { currencyA, currencyB, currencyPair, date }: RateParams,
  fallBackRates = fallbackConstantRatePairs
): RatesDocument => {
  const result = { _id: date }
  const currencyPairB = `${currencyB}_${currencyA}`

  if (fallBackRates[currencyPair] != null) {
    return { ...result, [currencyPair]: fallBackRates[currencyPair] }
  }

  if (fallBackRates[currencyPairB] != null) {
    return { ...result, [currencyPair]: fallBackRates[currencyPairB] }
  }
  return result
}

export const getRateFromDB = async (
  rateParams: RateParams,
  localDb: any
): Promise<RatesDocument> => {
  const { currencyPair, date } = rateParams
  const result = { _id: date }
  const dbRate = await coinFromDb(rateParams, localDb)
  if (dbRate != null && dbRate !== '')
    return {
      ...result,
      [currencyPair]: dbRate
    }
  return result
}

export const getRatesDocument = async (
  { currencyPair, date }: RateParams,
  localDb: any
): Promise<RatesDocument> => {
  try {
    const ratesDocuments = await localDb.get(date)
    return ratesDocuments
  } catch (e) {
    if (e.error === 'not_found') {
      log(`${currencyPair} does not exist for date: ${date}`)
    }
    return {
      _id: date,
      [currencyPair]: ''
    }
  }
}

export const getRateFromExchanges = async (
  rateParam: RateParams,
  currencyRates: RatesDocument,
  exchanges: ProviderFetch[]
): Promise<RatesDocument> => {
  if (exchanges.length === 0) return currencyRates
  const exchange = exchanges[0]

  const { currencyPair } = rateParam
  const rates = { ...currencyRates }

  try {
    const rate = await exchange(rateParam)
    if (rate != null && rate !== '') {
      rates[currencyPair] = rate
      return rates
    }
  } catch (e) {}

  return getRateFromExchanges(rateParam, rates, exchanges.slice(1))
}
