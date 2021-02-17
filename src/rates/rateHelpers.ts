import { bns } from 'biggystring'

import {
  ErrorType,
  RateError,
  RateGetter,
  RateParams,
  RatesDocument,
  ReturnGetRate
} from '../types'
import { inverseRate, logger } from '../utils'

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
  const res: ReturnGetRate = {}
  const inversePair = `${currencyB}_${currencyA}`
  if (currencyRates[currencyPair] != null) {
    res.rate = currencyRates[currencyPair]
  } else if (currencyRates[inversePair] != null) {
    res.rate = inverseRate(currencyRates[inversePair])
  }
  return res
}

export const getDbRate: RateGetter = async ({ localDB }, rateParams) => {
  const { currencyPair, date } = rateParams
  try {
    const ratesDocuments = await localDB.get(date)
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

export const getZeroRate: RateGetter = (
  { zeroRateCurrencyCodes = {} },
  { currencyA, currencyB }
) =>
  zeroRateCurrencyCodes[currencyA] === true ||
  zeroRateCurrencyCodes[currencyB] === true
    ? { rate: '0' }
    : {}

export const getFallbackConstantRate: RateGetter = (
  { fallbackConstantRatePairs = {} },
  rateParams
) =>
  getDocumentRate(rateParams, {
    _id: rateParams.date,
    ...fallbackConstantRatePairs
  })

export const getExchangesRate: RateGetter = async (
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

export const getExpiredRate: RateGetter = (
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

export const getDbBridgedRate: RateGetter = async (
  { bridgeCurrencies = [] },
  rateParams,
  currencyRates
) => {
  const exchanges = [async () => Promise.resolve(null)]
  return getBridgedRate(
    { bridgeCurrencies, exchanges },
    rateParams,
    currencyRates
  )
}

export const getBridgedRate: RateGetter = async (
  { exchanges = [], bridgeCurrencies = ['USD'] },
  rateParams,
  currencyRates
) => {
  const { currencyA, currencyB, currencyPair } = rateParams

  if (exchanges.length === 0) return { document: currencyRates }

  const rates = { ...currencyRates }
  // If BridgedRate finds a rate, it adds it to the rates document
  const bridgedRate = async (currencyParam, pair): Promise<void> => {
    if (rates[pair] == null)
      return exchanges[0]({
        ...rateParams,
        ...currencyParam
      }).then(rate => {
        if (rate != null) rates[pair] = rate
      })
  }
  // Try to find a bridged rate usind all the 'bridgeCurrencies'
  for (const bridgeCurrency of bridgeCurrencies) {
    if (currencyA === bridgeCurrency || currencyB === bridgeCurrency) continue
    // Create Bridged Currency Pairs
    const pairA = `${currencyA}_${bridgeCurrency}`
    const pairB = `${bridgeCurrency}_${currencyB}`
    // Try to get both sides of the bridged currency
    try {
      await Promise.all([
        bridgedRate({ currencyB: bridgeCurrency }, pairA),
        bridgedRate({ currencyA: bridgeCurrency }, pairB)
      ])
    } catch (e) {}
    // If we got both sides, combine them and return
    if (rates[pairA] != null && rates[pairB] != null) {
      rates[currencyPair] = bns.mul(rates[pairA], rates[pairB])
      return { rate: currencyRates[currencyPair], document: rates }
    }
  }
  // Call getBridgedRate recursively without the current used exchange ('exchanges[0]')
  return getBridgedRate(
    { exchanges: exchanges.slice(1), bridgeCurrencies },
    rateParams,
    rates
  )
}
