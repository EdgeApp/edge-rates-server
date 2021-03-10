import { RateProvider } from '../types/types'
import { config } from '../utils/config'

const {
  zeroRateCurrencyCodes,
  fallbackConstantRatePairs,
  ratesLookbackLimit
} = config

// Check if one of the currency is a zero rate currency.
export const zeroRate: RateProvider = async ({ currencyA }) =>
  zeroRateCurrencyCodes[currencyA] ? '0' : null

// Check if the currencyPair has a default rate value.
export const fallbackConstantRate: RateProvider = async ({
  currencyA,
  currencyB
}) => fallbackConstantRatePairs[`${currencyA}_${currencyB}`] ?? null

// If no rate was found, and the request is old, set the rate to '0'.
export const expiredRate: RateProvider = async ({ date }) =>
  Date.now() - ratesLookbackLimit > new Date(date).getTime() ? '0' : null
