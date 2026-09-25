import type { EdgeAsset, StringNullMap } from '../../../types'
import { toCryptoKey } from '../../../utils'
import {
  cosmosRegistryChains,
  defiLlamaChainSlugs,
  evmChainIds,
  tokenIdToAddress
} from '../tokenAddress'
import { fetchChainRegistryAsset } from './chainRegistry'
import {
  type AddressIndex,
  type CoingeckoClient,
  fetchCoingeckoCoin,
  fetchCoingeckoContract,
  searchCoingecko
} from './coingecko'
import { fetchDefiLlamaToken } from './defillama'
import { fetchEtherscanContract } from './etherscan'
import { fetchGoPlusToken, toGoPlusChainId } from './goplus'
import { lookupIssuerRegistry } from './issuerRegistry'
import { fetchJupiterToken } from './jupiter'
import { fetchRugCheckSummary } from './rugcheck'
import type {
  AssetEvidence,
  ChainFacts,
  FetchJson,
  IssuerRegistry,
  SearchHit,
  TokenListHit
} from './types'

export interface ChainDocs {
  /** The `tokenTypes` document. */
  tokenTypes: StringNullMap
  /** The `coingecko:platforms` document. */
  platforms: StringNullMap
}

export interface GatherDeps {
  fetchJson: FetchJson
  coingecko: CoingeckoClient
  /** Lazily loaded and cached for the run by the caller. */
  addressIndex: () => Promise<AddressIndex>
  tokenLists: (chainId: number, address: string) => Promise<TokenListHit[]>
  registry: IssuerRegistry
  goplusApiKey?: string
  etherscanApiKey?: string
}

export interface GatherOptions {
  /**
   * Hides CoinGecko's own listing of this address on this chain, so an
   * already-mapped asset behaves like an unresolved one (for testing and
   * calibration).
   */
  blind?: boolean
  maxCandidates?: number
}

export const describeChain = (
  docs: ChainDocs,
  pluginId: string
): ChainFacts => ({
  pluginId,
  tokenType: docs.tokenTypes[pluginId] ?? null,
  platformId: docs.platforms[pluginId] ?? null,
  evmChainId: evmChainIds[pluginId],
  defiLlamaSlug: defiLlamaChainSlugs[pluginId]
})

const uniqueStrings = (values: Array<string | undefined>): string[] => {
  const out: string[] = []
  for (const value of values) {
    if (value == null || value === '' || out.includes(value)) continue
    out.push(value)
  }
  return out
}

/**
 * Queries every scripted source for one asset. Sources that fail are
 * recorded in `errors` and never stop the others.
 */
export const gatherEvidence = async (
  asset: EdgeAsset,
  docs: ChainDocs,
  deps: GatherDeps,
  opts: GatherOptions = {}
): Promise<AssetEvidence> => {
  const { blind = false, maxCandidates = 5 } = opts
  const { pluginId, tokenId } = asset
  const chain = describeChain(docs, pluginId)
  const address =
    tokenId != null ? tokenIdToAddress(chain.tokenType, tokenId) : undefined

  const evidence: AssetEvidence = {
    key: toCryptoKey(asset),
    asset,
    chain,
    address,
    coingecko: { addressIndex: [], search: [], candidates: [] },
    tokenLists: [],
    errors: [],
    gatheredAt: new Date().toISOString()
  }
  const attempt = async <T>(
    source: string,
    run: () => Promise<T>
  ): Promise<T | undefined> => {
    try {
      return await run()
    } catch (error: unknown) {
      evidence.errors.push({
        source,
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  evidence.issuerRegistry = lookupIssuerRegistry(
    deps.registry,
    pluginId,
    tokenId
  )

  if (address != null) {
    const { defiLlamaSlug, evmChainId, platformId } = chain
    if (defiLlamaSlug != null) {
      evidence.defiLlama = await attempt(
        'defillama',
        async () =>
          await fetchDefiLlamaToken(deps.fetchJson, defiLlamaSlug, address)
      )
    }
    if (evmChainId != null) {
      evidence.tokenLists =
        (await attempt(
          'tokenlists',
          async () => await deps.tokenLists(evmChainId, address)
        )) ?? []
    }
    const registryChain = cosmosRegistryChains[pluginId]
    if (chain.tokenType === 'cosmos' && registryChain != null) {
      evidence.chainRegistry = await attempt(
        'chain-registry',
        async () =>
          await fetchChainRegistryAsset(deps.fetchJson, registryChain, address)
      )
    }
    if (pluginId === 'solana') {
      evidence.jupiter = await attempt(
        'jupiter',
        async () => await fetchJupiterToken(deps.fetchJson, address)
      )
      evidence.rugcheck = await attempt(
        'rugcheck',
        async () => await fetchRugCheckSummary(deps.fetchJson, address)
      )
    }
    if (!blind && platformId != null) {
      evidence.coingecko.contract = await attempt(
        'coingecko:contract',
        async () =>
          await fetchCoingeckoContract(deps.coingecko, platformId, address)
      )
    }
    const index = await attempt('coingecko:list', deps.addressIndex)
    const indexHits = index?.get(address.toLowerCase()) ?? []
    evidence.coingecko.addressIndex = blind
      ? indexHits.filter(hit => hit.pluginId !== pluginId)
      : indexHits

    const goPlusChainId = toGoPlusChainId(pluginId, evmChainId)
    if (goPlusChainId != null) {
      evidence.goplus = await attempt(
        'goplus',
        async () =>
          await fetchGoPlusToken(
            deps.fetchJson,
            goPlusChainId,
            address,
            deps.goplusApiKey
          )
      )
    }
    const { etherscanApiKey } = deps
    if (
      evmChainId != null &&
      etherscanApiKey != null &&
      etherscanApiKey !== ''
    ) {
      evidence.etherscan = await attempt(
        'etherscan',
        async () =>
          await fetchEtherscanContract(
            deps.fetchJson,
            evmChainId,
            address,
            etherscanApiKey
          )
      )
    }
  }

  // Search by the symbols the sources report, or by the pluginId for a native coin:
  const queries = uniqueStrings([
    evidence.defiLlama?.symbol,
    evidence.jupiter?.symbol,
    evidence.chainRegistry?.symbol,
    evidence.tokenLists[0]?.symbol,
    evidence.goplus?.token_symbol,
    tokenId == null ? pluginId : undefined
  ]).slice(0, 2)
  for (const query of queries) {
    const hits =
      (await attempt(
        'coingecko:search',
        async () => await searchCoingecko(deps.coingecko, query)
      )) ?? []
    for (const hit of hits) {
      if (evidence.coingecko.search.some(known => known.id === hit.id)) continue
      evidence.coingecko.search.push(hit)
    }
  }

  // Coins the evidence names come first, then the best search hits:
  const named: Array<string | undefined> = [
    evidence.coingecko.contract?.id,
    evidence.issuerRegistry?.coingeckoId,
    evidence.chainRegistry?.coingeckoId,
    ...evidence.coingecko.addressIndex.map(hit => hit.id),
    ...evidence.coingecko.search.map((hit: SearchHit) => hit.id)
  ]
  for (const id of uniqueStrings(named).slice(0, maxCandidates)) {
    const contract = evidence.coingecko.contract
    if (contract?.id === id) {
      evidence.coingecko.candidates.push(contract)
      continue
    }
    const coin = await attempt(
      'coingecko:coin',
      async () => await fetchCoingeckoCoin(deps.coingecko, id)
    )
    if (coin != null) evidence.coingecko.candidates.push(coin)
  }

  return evidence
}
