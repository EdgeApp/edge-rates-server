import { addIso, invertPair } from '../utils/utils'
import { NewRates, ReturnRate } from './../rates'
import {
  fallbackConstantRates as fallbackRates,
  zeroRates as zeroRateCodes
} from './../utils/currencyCodeMaps.json'

export const zeroRates = (rateObj: ReturnRate[]): NewRates => {
  const rates = {}
  for (const pair of rateObj) {
    if (
      pair.currency_pair.split('_').some(code => zeroRateCodes[code] === '0')
    ) {
      if (rates[pair.date] == null) {
        rates[pair.date] = {}
      }
      rates[pair.date][pair.currency_pair] = '0'
    }
  }
  return rates
}

const constantRates = Object.keys(fallbackRates).reduce(
  (res, pair) => ({
    ...res,
    [`${pair.split('_')[0]}_${addIso(pair.split('_')[1])}`]: fallbackRates[pair]
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
