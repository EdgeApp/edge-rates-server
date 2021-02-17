import { bns } from 'biggystring'

import CONFIG from '../../serverConfig.json'
import {
  ProviderFetch,
  RateParams,
  RatesDocument,
  ReturnGetRate
} from '../types'

const { bridgeCurrencies } = CONFIG

export const currencyBridge = async (
  rateParams: RateParams,
  currencyRates: RatesDocument = { _id: rateParams.date },
  rateProviders: ProviderFetch | ProviderFetch[] = async () =>
    Promise.resolve(null)
): Promise<ReturnGetRate> => {
  const { currencyA, currencyB, currencyPair } = rateParams
  const providers = Array.isArray(rateProviders)
    ? [...rateProviders]
    : [rateProviders]
  if (currencyRates[currencyPair] != null)
    return { rate: currencyRates[currencyPair], document: currencyRates }

  if (providers.length === 0) {
    return { document: currencyRates }
  }

  const rates = { ...currencyRates }
  const rateProvider = providers[0]

  for (const bridgeCurrency of bridgeCurrencies) {
    if (currencyA === bridgeCurrency || currencyB === bridgeCurrency) continue
    const pairA = `${currencyA}_${bridgeCurrency}`
    const pairB = `${bridgeCurrency}_${currencyB}`

    const bridgedRate = async (currencyParam, pair): Promise<void> => {
      if (rates[pair] == null)
        return rateProvider({
          ...rateParams,
          ...currencyParam
        }).then(rate => {
          if (rate != null) rates[pair] = rate
        })
    }

    try {
      await Promise.all([
        bridgedRate({ currencyB: bridgeCurrency }, pairA),
        bridgedRate({ currencyA: bridgeCurrency }, pairB)
      ])
    } catch (e) {}

    if (rates[pairA] != null && rates[pairB] != null) {
      rates[currencyPair] = bns.mul(rates[pairA], rates[pairB])
      return currencyBridge(rateParams, rates, providers)
    }
  }

  return currencyBridge(rateParams, rates, providers.slice(1))
}
