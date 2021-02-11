import { bns } from 'biggystring'

import CONFIG from '../../serverConfig.json'
import { ProviderFetch, RateParams, RatesDocument } from '../types'

const { bridgeCurrencies } = CONFIG

export const currencyBridge = async (
  rateParams: RateParams,
  currencyRates: RatesDocument,
  getExchangeRate: ProviderFetch
): Promise<RatesDocument> => {
  const { currencyA, currencyB } = rateParams
  const rates = { ...currencyRates }

  for (const bridgeCurrency of bridgeCurrencies) {
    if (currencyA === bridgeCurrency || currencyB === bridgeCurrency) continue
    const pairA = `${currencyA}_${bridgeCurrency}`
    const pairB = `${bridgeCurrency}_${currencyB}`

    try {
      const bridgeRate =
        rates[pairA] ??
        (await getExchangeRate({ ...rateParams, currencyB: bridgeCurrency })) ??
        ''
      if (bridgeRate !== '') rates[pairA] = bridgeRate
    } catch (e) {}

    try {
      const bridgeRate =
        rates[pairB] ??
        (await getExchangeRate({ ...rateParams, currencyA: bridgeCurrency })) ??
        ''
      if (bridgeRate !== '') rates[pairB] = bridgeRate
    } catch (e) {}

    if (rates[pairA] !== '' && rates[pairB] !== '') {
      const rate = bns.mul(rates[pairA], rates[pairB])
      rates[`${currencyA}_${currencyB}`] = rate
      return rates
    }
  }

  return rates
}
