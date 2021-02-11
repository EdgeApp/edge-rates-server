import CONFIG from '../../serverConfig.json'
import { coinFromDb } from '../providers/coinFromDb'
import {
  ErrorType,
  ProviderFetch,
  RateError,
  RateParams,
  RatesDocument,
  ReturnGetRate
} from '../types'
import { log } from '../utils'
import { currencyBridge } from './currencyBridge'

const { zeroRateCurrencyCodes, fallbackConstantRatePairs } = CONFIG

export const rateError = (
  message: string,
  errorCode: number = 500,
  errorType?: ErrorType
): RateError => Object.assign(new Error(message), { errorCode, errorType })

export const getZeroRate = (
  { currencyA, currencyB }: RateParams,
  zeroRates = zeroRateCurrencyCodes
): ReturnGetRate | null => {
  if (zeroRates[currencyA] === true || zeroRates[currencyB] === true)
    return { rate: '0' }
  return null
}

export const getFallbackConstantRate = (
  { currencyA, currencyB }: RateParams,
  fallBackRates = fallbackConstantRatePairs
): ReturnGetRate | null => {
  // Use fallback hardcoded rates if lookups failed
  if (fallBackRates[`${currencyA}_${currencyB}`] != null) {
    return { rate: fallBackRates[`${currencyA}_${currencyB}`] }
  }

  if (fallBackRates[`${currencyB}_${currencyA}`] != null) {
    return { rate: fallBackRates[`${currencyB}_${currencyA}`] }
  }
  return null
}

export const getRateFromDB = async (
  rateParams: RateParams,
  localDb: any
): Promise<ReturnGetRate | null> => {
  const dbRate = await coinFromDb(rateParams, localDb)
  if (dbRate != null && dbRate !== '') return { rate: dbRate }
  else return null
}

export const getRatesDocument = async (
  { currencyA, currencyB, date }: RateParams,
  localDb: any
): Promise<RatesDocument> => {
  try {
    const ratesDocuments = await localDb.get(date)
    return ratesDocuments
  } catch (e) {
    const currencyPair = `${currencyA}_${currencyB}`
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
  const currencyPair = `${rateParam.currencyA}_${rateParam.currencyB}`

  for (const exchange of exchanges) {
    try {
      const exchangeRate = await exchange(rateParam)
      if (exchangeRate != null && exchangeRate !== '') {
        return {
          ...currencyRates,
          [currencyPair]: exchangeRate
        }
      }
    } catch (e) {}
  }

  return { ...currencyRates }
}

export const getRateFromExchangesBridge = async (
  rateParams: RateParams,
  currencyRates: RatesDocument,
  exchanges: ProviderFetch[]
): Promise<RatesDocument> => {
  const currencyPair = `${rateParams.currencyA}_${rateParams.currencyB}`

  for (const exchange of exchanges) {
    try {
      const bridgedRates = await currencyBridge(
        rateParams,
        currencyRates,
        exchange
      )
      const bridgedRate = bridgedRates[currencyPair]
      if (bridgedRate != null && bridgedRate !== '') {
        return bridgedRates
      }
    } catch (e) {}
  }

  return { ...currencyRates }
}
