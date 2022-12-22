/* eslint-disable @typescript-eslint/camelcase */

import { asArray, asNumber, asObject, asOptional, asString } from 'cleaners'

// Force TS to derive the type of the return value since it is pretty obvious
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const asCoingeckoAsset = (raw: any) => {
  const asset = asObject({
    symbol: asString,
    name: asString,
    image: asString,
    current_price: asOptional(asNumber),
    market_cap: asOptional(asNumber),
    market_cap_rank: asNumber,
    total_volume: asOptional(asNumber),
    price_change_percentage_1h_in_currency: asOptional(asNumber),
    price_change_percentage_24h_in_currency: asOptional(asNumber),
    price_change_percentage_7d_in_currency: asOptional(asNumber),
    price_change_percentage_30d_in_currency: asOptional(asNumber),
    price_change_percentage_1y_in_currency: asOptional(asNumber)
  })(raw)

  const {
    symbol,
    name,
    image,
    current_price,
    market_cap,
    market_cap_rank,
    total_volume,
    price_change_percentage_1h_in_currency,
    price_change_percentage_24h_in_currency,
    price_change_percentage_7d_in_currency,
    price_change_percentage_30d_in_currency,
    price_change_percentage_1y_in_currency
  } = asset

  const out = {
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
    volume24h: total_volume ?? 0
  }

  return out
}

export const asCoingeckoMarkets = asArray(asCoingeckoAsset)

export type CoinrankMarkets = ReturnType<typeof asCoingeckoMarkets>
export interface CoinrankRedis {
  lastUpdate: string
  markets: CoinrankMarkets
}
