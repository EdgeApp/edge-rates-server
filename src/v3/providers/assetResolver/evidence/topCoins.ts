import {
  asArray,
  asJSON,
  asMaybe,
  asNumber,
  asObject,
  asString,
  asUnknown
} from 'cleaners'

import { type CoingeckoClient, fetchCoingeckoMarkets } from './coingecko'
import type { SearchHit } from './types'

const asCoinrankMarket = asObject({
  assetId: asString,
  currencyCode: asString,
  currencyName: asString,
  rank: asNumber
})
const asCoinrankDoc = asObject({ markets: asArray(asUnknown) })

/**
 * The top coins by market cap, for spotting tokens that impersonate one.
 * Prefers the coinrank document the coinrank engine keeps in Redis, and
 * falls back to two pages of CoinGecko markets when Redis is not around.
 */
export const loadTopCoins = async (deps: {
  readCoinrank?: () => Promise<string | null>
  coingecko: CoingeckoClient
}): Promise<SearchHit[]> => {
  if (deps.readCoinrank != null) {
    const json = await deps.readCoinrank()
    const doc = json == null ? undefined : asMaybe(asJSON(asCoinrankDoc))(json)
    if (doc != null) {
      const hits: SearchHit[] = []
      for (const raw of doc.markets) {
        const market = asMaybe(asCoinrankMarket)(raw)
        if (market == null) continue
        hits.push({
          id: market.assetId,
          symbol: market.currencyCode,
          name: market.currencyName,
          marketCapRank: market.rank
        })
      }
      if (hits.length > 0) return hits
    }
  }
  const pages = await Promise.all([
    fetchCoingeckoMarkets(deps.coingecko, 1),
    fetchCoingeckoMarkets(deps.coingecko, 2)
  ])
  return pages.flat()
}
