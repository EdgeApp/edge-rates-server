import { addIso, invertPair } from '../utils/utils'
import { AssetMap, NewRates, ReturnRate } from './../rates'

export const zeroRates = (
  rateObj: ReturnRate[],
  currentTime: string,
  assetMap: AssetMap
): NewRates => {
  const rates = {}
  for (const pair of rateObj) {
    if (pair.currency_pair.split('_').some(code => assetMap[code] === '0')) {
      if (rates[pair.date] == null) {
        rates[pair.date] = {}
      }
      rates[pair.date][pair.currency_pair] = '0'
    }
  }
  return rates
}

export const fallbackConstantRates = (
  rateObj: ReturnRate[],
  currentTime: string,
  assetMap: AssetMap
): NewRates => {
  const rates = {}

  // Initialize currencies
  const constantRates = Object.keys(assetMap).reduce(
    (res, pair) => ({
      ...res,
      [`${pair.split('_')[0]}_${addIso(pair.split('_')[1])}`]: assetMap[pair]
    }),
    {}
  )

  // Search for matches
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
