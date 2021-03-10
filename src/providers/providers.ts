import { RateProvider } from '../types/types'
import { inverseRate } from '../utils/utils'
import { coincapHistorical } from './coincapHistorical'
import { coinMarketCapHistorical, coinMarketCapLatest } from './coinMarketCap'
import { expiredRate, fallbackConstantRate, zeroRate } from './constantRates'
import { currencyConverter } from './currencyConverter'

export const flipProvider = (
  provider: RateProvider
): RateProvider => async rateParams => {
  try {
    // Query provider for rate
    const rate = await provider(rateParams)
    if (rate != null) return rate
  } catch (e) {}

  const { currencyB, currencyA } = rateParams
  try {
    // Invert pair and query provider for rate
    const rate = await provider({
      ...rateParams,
      currencyA: currencyB,
      currencyB: currencyA,
      currencyPair: `${currencyB}_${currencyA}`
    })
    if (rate != null) return inverseRate(rate)
  } catch (e) {}

  // Return null if both cases fail
  return null
}

export const defaultProviders = [
  zeroRate,
  fallbackConstantRate,
  expiredRate,
  currencyConverter,
  coinMarketCapLatest,
  coincapHistorical,
  coinMarketCapHistorical
].map(provider => flipProvider(provider))
