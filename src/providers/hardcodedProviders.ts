import { div } from 'biggystring'

import { currencyCodeArray, invertPair } from '../utils/utils'
import { AssetMap, NewRates, PRECISION, ReturnRate } from './../rates'

export const zeroRates = (
  rateObj: ReturnRate[],
  currentTime: string,
  assetMap: AssetMap
): NewRates => {
  const rates = {}
  for (const pair of rateObj) {
    if (
      currencyCodeArray(pair.currency_pair).some(code => assetMap[code] === '0')
    ) {
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

  // Search for matches
  for (const pair of rateObj) {
    if (rates[pair.date] == null) {
      rates[pair.date] = {}
    }

    if (assetMap[pair.currency_pair] != null) {
      rates[pair.date][pair.currency_pair] = assetMap[pair.currency_pair]
      continue
    }
    if (assetMap[invertPair(pair.currency_pair)] != null) {
      const invertedRate = assetMap[invertPair(pair.currency_pair)]
      rates[pair.date][pair.currency_pair] =
        invertedRate !== '0' ? div('1', invertedRate, PRECISION) : '0'
    }
  }
  return rates
}
