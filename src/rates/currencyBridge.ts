import { bns } from 'biggystring'

import CONFIG from '../../serverConfig.json'
import { ProviderFetch, RateParams, RatesDocument } from '../types'

const { bridgeCurrencies } = CONFIG

export const currencyBridge = async (
  rateParams: RateParams,
  currencyRates: RatesDocument,
  rateProviders: ProviderFetch | ProviderFetch[]
): Promise<RatesDocument> => {
  const providers = Array.isArray(rateProviders)
    ? [...rateProviders]
    : [rateProviders]
  if (providers.length === 0) return currencyRates
  const rateProvider = providers[0]

  const { currencyA, currencyB } = rateParams
  const rates = { ...currencyRates }

  for (const bridgeCurrency of bridgeCurrencies) {
    if (currencyA === bridgeCurrency || currencyB === bridgeCurrency) continue
    const pairA = `${currencyA}_${bridgeCurrency}`
    const pairB = `${bridgeCurrency}_${currencyB}`

    try {
      const bridgeRate =
        rates[pairA] ??
        (await rateProvider({ ...rateParams, currencyB: bridgeCurrency })) ??
        ''
      if (bridgeRate !== '') rates[pairA] = bridgeRate
    } catch (e) {}

    try {
      const bridgeRate =
        rates[pairB] ??
        (await rateProvider({ ...rateParams, currencyA: bridgeCurrency })) ??
        ''
      if (bridgeRate !== '') rates[pairB] = bridgeRate
    } catch (e) {}

    if (rates[pairA] !== '' && rates[pairB] !== '') {
      const rate = bns.mul(rates[pairA], rates[pairB])
      rates[`${currencyA}_${currencyB}`] = rate
      return rates
    }
  }

  return currencyBridge(rateParams, rates, providers.slice(1))
}
