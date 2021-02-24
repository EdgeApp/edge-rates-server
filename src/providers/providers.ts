import { ProviderFetch } from '../types/types'
import { inverseRate } from '../utils/utils'
import { coincapHistorical } from './coincapHistorical'
import { coinMarketCapHistorical, coinMarketCapLatest } from './coinMarketCap'
import { currencyConverter } from './currencyConverter'

export const providerFetch = (
  provider: ProviderFetch
): ProviderFetch => async rateParams => {
  const { currencyA, currencyB } = rateParams

  try {
    // Query provider for rate
    const rate = await provider(rateParams)
    if (rate != null) return rate
  } catch (e) {}

  try {
    // Invert pair and query provider for rate
    const invertedParams = {
      ...rateParams,
      currencyA: currencyB,
      currencyB: currencyA
    }
    const rate = await provider(invertedParams)
    if (rate != null) return inverseRate(rate)
  } catch (e) {}

  // Return null if both cases fail
  return null
}

export const defaultProviders = [
  currencyConverter,
  coinMarketCapLatest,
  coincapHistorical,
  coinMarketCapHistorical
].map(provider => providerFetch(provider))
