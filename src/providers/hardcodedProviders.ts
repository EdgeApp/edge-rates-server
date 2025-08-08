import { div } from 'biggystring'

import { currencyCodeArray, fromCode, toCode } from '../utils/utils'
import { AssetMap, NewRates, PRECISION, ReturnRate } from './../rates'

export const zeroRates = (
  rateObj: ReturnRate[],
  currentTime: string,
  assetMap: AssetMap
): NewRates => {
  const rates: NewRates = {}
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
  const rates: NewRates = {}

  // Search for matches
  for (const pair of rateObj) {
    if (rates[pair.date] == null) {
      rates[pair.date] = {}
    }

    const requestedCurrencyPair = pair.currency_pair // exists in assetMap the same way a consumer would request it "USD.st_iso:USD"
    const dbSafeCurrencyPair = `${fromCode(pair.currency_pair)}_${toCode(
      pair.currency_pair
    )}` // The format we would store in the database "USD.ST_iso:USD"

    if (assetMap[requestedCurrencyPair] != null) {
      rates[pair.date][dbSafeCurrencyPair] = assetMap[requestedCurrencyPair]
      continue
    }

    const inversePair = pair.currency_pair.split('_').reverse().join('_')
    if (assetMap[inversePair] != null) {
      const invertedRate = assetMap[inversePair]
      rates[pair.date][dbSafeCurrencyPair] =
        invertedRate !== '0' ? div('1', invertedRate, PRECISION) : '0'
    }
  }
  return rates
}
