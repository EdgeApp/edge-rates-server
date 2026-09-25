import { asMaybe } from 'cleaners'

import { snooze } from '../../../../utils/utils'
import {
  type AddressIndexHit,
  asCoingeckoCoin,
  asCoingeckoList,
  asCoingeckoListCoin,
  asCoingeckoMarket,
  asCoingeckoMarkets,
  asCoingeckoSearch,
  asCoingeckoSearchCoin,
  type CandidateCoin,
  type CoingeckoCoin,
  type FetchJson,
  type JsonResponse,
  type SearchHit
} from './types'

export interface CoingeckoClient {
  get: (path: string) => Promise<JsonResponse>
}

/**
 * A CoinGecko Pro client that spaces requests and retries rate limits the
 * way the rates provider does.
 */
export const makeCoingeckoClient = (opts: {
  uri: string
  apiKey: string
  fetchJson: FetchJson
  spacingMs?: number
}): CoingeckoClient => {
  const { uri, apiKey, fetchJson, spacingMs = 0 } = opts
  let lastRequest = 0
  return {
    get: async path => {
      let retries = 0
      while (true) {
        const wait = lastRequest + spacingMs - Date.now()
        if (wait > 0) await snooze(wait)
        lastRequest = Date.now()
        const reply = await fetchJson(`${uri}/api/v3${path}`, {
          headers: { 'x-cg-pro-api-key': apiKey }
        })
        if (reply.status !== 429) return reply
        retries++
        if (retries > 2) throw new Error('coingecko rate limit exceeded')
        await snooze(1000)
      }
    }
  }
}

/** Coins listing an address, by lower-case address. */
export type AddressIndex = Map<string, AddressIndexHit[]>

/** Indexes every listed contract address from `/coins/list`. */
export const fetchAddressIndex = async (
  client: CoingeckoClient,
  platformToPluginId: Record<string, string>
): Promise<AddressIndex> => {
  const { status, body } = await client.get('/coins/list?include_platform=true')
  if (status !== 200) throw new Error(`coingecko list replied ${status}`)

  const index: AddressIndex = new Map()
  for (const raw of asCoingeckoList(body)) {
    const coin = asMaybe(asCoingeckoListCoin)(raw)
    if (coin == null) continue
    for (const [platformId, address] of Object.entries(coin.platforms)) {
      if (address == null || address === '') continue
      const hit: AddressIndexHit = {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        platformId,
        pluginId: platformToPluginId[platformId]
      }
      const key = address.toLowerCase()
      const hits = index.get(key) ?? []
      hits.push(hit)
      index.set(key, hits)
    }
  }
  return index
}

const toCandidate = (coin: CoingeckoCoin): CandidateCoin => {
  const platforms: Record<string, string> = {}
  for (const [platformId, address] of Object.entries(coin.platforms)) {
    if (address != null && address !== '') platforms[platformId] = address
  }
  const homepage: string[] = []
  for (const url of coin.links.homepage) {
    if (url != null && url !== '') homepage.push(url)
  }
  const categories: string[] = []
  for (const category of coin.categories) {
    if (category != null) categories.push(category)
  }
  return {
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    marketCapRank: coin.market_cap_rank ?? undefined,
    platforms,
    homepage,
    categories,
    priceUsd: coin.market_data?.current_price.usd
  }
}

const coinQuery =
  '?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false'

/** A coin's platforms, links, categories, rank, and USD price. */
export const fetchCoingeckoCoin = async (
  client: CoingeckoClient,
  id: string
): Promise<CandidateCoin | undefined> => {
  const { status, body } = await client.get(
    `/coins/${encodeURIComponent(id)}${coinQuery}`
  )
  if (status === 404) return
  if (status !== 200) throw new Error(`coingecko coin replied ${status}`)
  return toCandidate(asCoingeckoCoin(body))
}

/** The coin CoinGecko lists at an address on a platform, if any. */
export const fetchCoingeckoContract = async (
  client: CoingeckoClient,
  platformId: string,
  address: string
): Promise<CandidateCoin | undefined> => {
  const { status, body } = await client.get(
    `/coins/${encodeURIComponent(platformId)}/contract/${encodeURIComponent(
      address
    )}`
  )
  if (status === 404) return
  if (status !== 200) throw new Error(`coingecko contract replied ${status}`)
  return toCandidate(asCoingeckoCoin(body))
}

export const searchCoingecko = async (
  client: CoingeckoClient,
  query: string
): Promise<SearchHit[]> => {
  const { status, body } = await client.get(
    `/search?query=${encodeURIComponent(query)}`
  )
  if (status !== 200) throw new Error(`coingecko search replied ${status}`)
  const hits: SearchHit[] = []
  for (const raw of asCoingeckoSearch(body).coins) {
    const coin = asMaybe(asCoingeckoSearchCoin)(raw)
    if (coin == null) continue
    hits.push({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      marketCapRank: coin.market_cap_rank ?? undefined
    })
  }
  return hits
}

/** One page of 250 coins by market cap. */
export const fetchCoingeckoMarkets = async (
  client: CoingeckoClient,
  page: number
): Promise<SearchHit[]> => {
  const { status, body } = await client.get(
    `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`
  )
  if (status !== 200) throw new Error(`coingecko markets replied ${status}`)
  const hits: SearchHit[] = []
  for (const raw of asCoingeckoMarkets(body)) {
    const coin = asMaybe(asCoingeckoMarket)(raw)
    if (coin == null) continue
    hits.push({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      marketCapRank: coin.market_cap_rank ?? undefined
    })
  }
  return hits
}
