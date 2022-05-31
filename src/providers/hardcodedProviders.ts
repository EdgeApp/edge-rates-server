import { ExchangeRateReq } from '../exchangeRateRouter'
import {
  currencyCodeArray,
  fromCode,
  fromCryptoToFiatCurrencyPair,
  invertPair,
  toCode
} from '../utils/utils'
import { AssetMap, NewRates } from './../rates'

export const zeroRates = (
  rateObj: ExchangeRateReq[],
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
  rateObj: ExchangeRateReq[],
  currentTime: string,
  assetMap: AssetMap
): NewRates => {
  const rates = {}

  // Initialize currencies
  const constantRates = Object.keys(assetMap).reduce(
    (res, pair) => ({
      ...res,
      [fromCryptoToFiatCurrencyPair(fromCode(pair), toCode(pair))]: assetMap[
        pair
      ]
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
