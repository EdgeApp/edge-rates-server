import { bns } from 'biggystring'

import { RateGetter } from '../types'

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
