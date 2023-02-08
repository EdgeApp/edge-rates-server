/* eslint-disable @typescript-eslint/camelcase */

import {
  asArray,
  asDate,
  asNumber,
  asObject,
  asOptional,
  asString
} from 'cleaners'

const asStringNum = (raw: any): number => {
  return Number(asString(raw))
}

export const asCoinrankReq = asObject({
  fiatCode: asOptional(asString, 'iso:USD'),
  start: asOptional(asStringNum, 1),
  length: asOptional(asStringNum, 100)
})

export type CoinrankReq = ReturnType<typeof asCoinrankReq>

// Force TS to derive the type of the return value since it is pretty obvious
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const asCoingeckoAsset = (raw: any) => {
  const asset = asObject({
    id: asString,
    symbol: asString,
    name: asString,
    image: asString,
    current_price: asOptional(asNumber),
    market_cap: asOptional(asNumber),
    market_cap_rank: asNumber,

    high_24h: asOptional(asNumber),
    low_24h: asOptional(asNumber),
    price_change_24h: asOptional(asNumber),
    price_change_percentage_24h: asOptional(asNumber),
    market_cap_change_24h: asOptional(asNumber),
    market_cap_change_percentage_24h: asOptional(asNumber),
    circulating_supply: asOptional(asNumber),
    total_supply: asOptional(asNumber),
    max_supply: asOptional(asNumber),
    ath: asOptional(asNumber),
    ath_date: asOptional(asString),
    atl: asOptional(asNumber),
    atl_date: asOptional(asString),

    total_volume: asOptional(asNumber),
    price_change_percentage_1h_in_currency: asOptional(asNumber),
    price_change_percentage_24h_in_currency: asOptional(asNumber),
    price_change_percentage_7d_in_currency: asOptional(asNumber),
    price_change_percentage_30d_in_currency: asOptional(asNumber),
    price_change_percentage_1y_in_currency: asOptional(asNumber)
  })(raw)

  const {
    id,
    symbol,
    name,
    image,
    current_price,
    market_cap,
    market_cap_rank,
    total_volume,
    high_24h,
    low_24h,
    price_change_24h,
    price_change_percentage_24h,
    market_cap_change_24h,
    market_cap_change_percentage_24h,
    circulating_supply,
    total_supply,
    max_supply,
    ath,
    ath_date,
    atl,
    atl_date,
    price_change_percentage_1h_in_currency,
    price_change_percentage_24h_in_currency,
    price_change_percentage_7d_in_currency,
    price_change_percentage_30d_in_currency,
    price_change_percentage_1y_in_currency
  } = asset

  const out = {
    assetId: id,
    currencyCode: symbol,
    currencyName: name,
    imageUrl: image,
    marketCap: market_cap ?? 0,
    percentChange: {
      hours1: price_change_percentage_1h_in_currency ?? 0,
      hours24: price_change_percentage_24h_in_currency ?? 0,
      days7: price_change_percentage_7d_in_currency ?? 0,
      days30: price_change_percentage_30d_in_currency ?? 0,
      year1: price_change_percentage_1y_in_currency ?? 0
    },
    price: current_price ?? 0,
    rank: market_cap_rank,
    volume24h: total_volume ?? 0,

    high24h: high_24h,
    low24h: low_24h,
    priceChange24h: price_change_24h,
    priceChangePercent24h: price_change_percentage_24h,
    marketCapChange24h: market_cap_change_24h,
    marketCapChangePercent24h: market_cap_change_percentage_24h,
    circulatingSupply: circulating_supply,
    totalSupply: total_supply,
    maxSupply: max_supply,
    allTimeHigh: ath,
    allTimeHighDate: ath_date,
    allTimeLow: atl,
    allTimeLowDate: atl_date
  }

  return out
}

export const asCoingeckoMarkets = asArray(asCoingeckoAsset)

export type CoinrankMarkets = ReturnType<typeof asCoingeckoMarkets>
export interface CoinrankRedis {
  lastUpdate: string
  markets: CoinrankMarkets
}

export const asExchangeRateResponse = asObject({
  currency_pair: asString,
  date: asDate,
  exchangeRate: asString
})
