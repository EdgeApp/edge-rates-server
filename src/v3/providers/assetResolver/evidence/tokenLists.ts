import { asMaybe } from 'cleaners'

import {
  asTokenList,
  asTokenListToken,
  type FetchJson,
  type TokenListHit,
  type TokenListToken
} from './types'

/**
 * Official token lists whose entries name the origin token they bridge from.
 * Uniswap-style lists carry `extensions.bridgeInfo`; Superchain-style lists
 * group one token's deployments under `extensions.opTokenId`.
 */
export const tokenListUrls: Record<string, string> = {
  uniswap: 'https://tokens.uniswap.org',
  superchain: 'https://static.optimism.io/optimism.tokenlist.json'
}

const fetchTokens = async (
  fetchJson: FetchJson,
  url: string
): Promise<TokenListToken[]> => {
  const { status, body } = await fetchJson(url)
  if (status !== 200) throw new Error(`Token list replied ${status}`)
  const tokens: TokenListToken[] = []
  for (const raw of asTokenList(body).tokens) {
    const token = asMaybe(asTokenListToken)(raw)
    if (token != null) tokens.push(token)
  }
  return tokens
}

const toHit = (
  list: string,
  token: TokenListToken,
  siblings: TokenListToken[]
): TokenListHit => {
  const bridgeInfo: Array<{ chainId: number; tokenAddress: string }> = []
  const extensions = token.extensions
  if (extensions?.bridgeInfo != null) {
    for (const [chainId, info] of Object.entries(extensions.bridgeInfo)) {
      bridgeInfo.push({
        chainId: Number(chainId),
        tokenAddress: info.tokenAddress
      })
    }
  }
  if (extensions?.opTokenId != null) {
    for (const sibling of siblings) {
      if (
        sibling.chainId !== token.chainId &&
        sibling.extensions?.opTokenId === extensions.opTokenId
      ) {
        bridgeInfo.push({
          chainId: sibling.chainId,
          tokenAddress: sibling.address
        })
      }
    }
  }
  return {
    list,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    bridgeInfo
  }
}

/** Caches each list for one run and looks tokens up by chain and address. */
export const makeTokenListLookup = (
  fetchJson: FetchJson,
  urls: Record<string, string> = tokenListUrls
): ((chainId: number, address: string) => Promise<TokenListHit[]>) => {
  const cache = new Map<string, Promise<TokenListToken[]>>()
  const load = async (list: string): Promise<TokenListToken[]> => {
    let promise = cache.get(list)
    if (promise == null) {
      promise = fetchTokens(fetchJson, urls[list])
      cache.set(list, promise)
    }
    return await promise
  }

  return async (chainId, address) => {
    const wanted = address.toLowerCase()
    const hits: TokenListHit[] = []
    for (const list of Object.keys(urls)) {
      const tokens = await load(list)
      for (const token of tokens) {
        if (token.chainId !== chainId) continue
        if (token.address.toLowerCase() !== wanted) continue
        hits.push(toHit(list, token, tokens))
      }
    }
    return hits
  }
}
