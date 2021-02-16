import { bns } from 'biggystring'

import { ProviderFetch } from '../types'
import { coincapHistorical } from './coincapHistorical'
import { coinMarketCapHistorical, coinMarketCapLatest } from './coinMarketCap'
import { currencyConverter } from './currencyConverter'

export const providerFetch = (
  provider: ProviderFetch
): ProviderFetch => async rateParams => {
  const { currencyA, currencyB } = rateParams

  try {
    // Query provider for rate
    const response = await provider(rateParams)
    if (response != null) return response
  } catch (e) {}

  try {
    // Invert pair and query provider for rate
    const invertedParams = {
      ...rateParams,
      currencyA: currencyB,
      currencyB: currencyA
    }
    const response = await provider(invertedParams)
    if (response != null) return bns.div('1', response, 8, 10)
  } catch (e) {}

  // Return null if both cases fail
  return ''
}

export const defaultProviders = [
  currencyConverter,
  coinMarketCapLatest,
  coincapHistorical,
  coinMarketCapHistorical
].map(provider => providerFetch(provider))
