import { invertPair } from '../utils/utils'
import { NewRates, ReturnRate } from './../rates'
import {
  fallbackConstantRatePairs,
  zeroRateCurrencyCodes
} from './../utils/currencyCodeMaps'

export const zeroRates = (rateObj: ReturnRate[]): NewRates => {
  const rates = {}
  for (const pair of rateObj) {
    if (
      zeroRateCurrencyCodes[pair.currency_pair.split('_')[0]] === true ||
      zeroRateCurrencyCodes[pair.currency_pair.split('_')[1]] === true
    ) {
      if (rates[pair.date] == null) {
        rates[pair.date] = {}
      }
      rates[pair.date][pair.currency_pair] = '0'
    }
  }
  return rates
}

export const fallbackConstantRates = (rateObj: ReturnRate[]): NewRates => {
  const rates = {}
  for (const pair of rateObj) {
    if (fallbackConstantRatePairs[pair.currency_pair] != null) {
      if (rates[pair.date] == null) {
        rates[pair.date] = {}
      }
      rates[pair.date][pair.currency_pair] =
        fallbackConstantRatePairs[pair.currency_pair]
    }
    if (fallbackConstantRatePairs[invertPair(pair.currency_pair)] != null) {
      if (rates[pair.date] == null) {
        rates[pair.date] = {}
      }
      rates[pair.date][pair.currency_pair] =
        fallbackConstantRatePairs[invertPair(pair.currency_pair)]
    }
  }
  return rates
}
