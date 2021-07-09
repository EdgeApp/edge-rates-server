import { invertPair } from '../utils/utils'
import { NewRates, ReturnRate } from './../rates'
import {
  fallbackConstantRatePairs,
  zeroRateCurrencyCodes
} from './../utils/currencyCodeMaps.json'
import { addIso } from './../utils/utils'

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

const constantRates = Object.keys(fallbackConstantRatePairs).reduce(
  (res, pair) => ({
    ...res,
    [`${pair.split('_')[0]}_${addIso(
      pair.split('_')[1]
    )}`]: fallbackConstantRatePairs[pair]
  }),
  {}
)

export const fallbackConstantRates = (rateObj: ReturnRate[]): NewRates => {
  const rates = {}
  for (const pair of rateObj) {
    if (constantRates[pair.currency_pair] != null) {
      if (rates[pair.date] == null) {
        rates[pair.date] = {}
      }
      rates[pair.date][pair.currency_pair] = constantRates[pair.currency_pair]
    }
    if (constantRates[invertPair(pair.currency_pair)] != null) {
      if (rates[pair.date] == null) {
        rates[pair.date] = {}
      }
      rates[pair.date][pair.currency_pair] =
        constantRates[invertPair(pair.currency_pair)]
    }
  }
  return rates
}
