import bns from 'biggystring'

import { defaultProviders } from '../providers/providers'
import {
  RateGetter,
  RateGetterParams,
  RateGetterResponse,
  RatesGetterDocument
} from '../types/types'
import { inverseRate } from '../utils/utils'

const MINUTE = 60 * 1000

// Try to get the rate from a db document.
export const getDocumentRate = (
  { currencyA, currencyB, currencyPair }: RateGetterParams,
  currencyRates: RatesGetterDocument
): RateGetterResponse => {
  if (currencyRates[currencyPair] != null) {
    return { rate: currencyRates[currencyPair] }
  }
  const inversePair = `${currencyB}_${currencyA}`
  if (currencyRates[inversePair] != null) {
    return { rate: inverseRate(currencyRates[inversePair]) }
  }
  return {}
}

// Check if one of the currency is a zero rate currency.
export const getZeroRate: RateGetter = (
  { zeroRateCurrencyCodes = {} },
  { currencyA, currencyB }
) =>
  zeroRateCurrencyCodes[currencyA] || zeroRateCurrencyCodes[currencyB]
    ? { rate: '0' }
    : {}

// Check if the currencyPair or the inverted has a default rate value.
export const getFallbackConstantRate: RateGetter = (
  { fallbackConstantRatePairs = {} },
  rateParams
) =>
  getDocumentRate(rateParams, {
    _id: rateParams.date,
    ...fallbackConstantRatePairs
  })

// Try to get the rate from any of the exchanges.
export const getExchangesRate: RateGetter = async (
  { exchanges = defaultProviders },
  rateParams,
  currencyRates
) => {
  if (exchanges.length === 0) return { document: currencyRates }

  try {
    const rate = await exchanges[0](rateParams)
    if (rate != null)
      return {
        rate,
        document: {
          ...(currencyRates ?? { _id: rateParams.currencyPair }),
          [rateParams.currencyPair]: rate
        }
      }
  } catch (e) {}

  return await getExchangesRate(
    { exchanges: exchanges.slice(1) },
    rateParams,
    currencyRates
  )
}

// If no rate was found, and the request is old, set the rate to '0'.
export const getExpiredRate: RateGetter = (
  { ratesLookbackLimit = MINUTE },
  { currencyPair, date },
  currencyRates
) => {
  if (Date.now() - ratesLookbackLimit > new Date(date).getTime()) {
    return {
      rate: '0',
      document: {
        ...(currencyRates ?? { _id: currencyPair }),
        [currencyPair]: '0'
      }
    }
  }
  return {}
}

// Try to get the rate from the db using bridged currencies.
export const getDbBridgedRate: RateGetter = async (
  { bridgeCurrencies = ['USD'] },
  rateParams,
  currencyRates
) =>
  await getBridgedRate(
    {
      bridgeCurrencies,
      exchanges: [async () => await Promise.resolve(null)]
    },
    rateParams,
    currencyRates
  )

// Try to get the rate from any of the exchanges using bridged currencies.
export const getBridgedRate: RateGetter = async (
  { exchanges = defaultProviders, bridgeCurrencies = ['USD'] },
  rateParams,
  currencyRates
) => {
  const { currencyA, currencyB, currencyPair } = rateParams

  if (exchanges.length === 0) return { document: currencyRates }

  const rates = { ...(currencyRates ?? { _id: currencyPair }) }
  // If BridgedRate finds a rate, it adds it to the rates document
  const bridgedRate = async (currencyParam, pair): Promise<void> => {
    if (rates[pair] == null)
      return await exchanges[0]({
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
      return { rate: rates[currencyPair], document: rates }
    }
  }
  // Call getBridgedRate recursively without the current used exchange ('exchanges[0]')
  return getBridgedRate(
    { exchanges: exchanges.slice(1), bridgeCurrencies },
    rateParams,
    rates
  )
}
