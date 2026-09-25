import {
  asArray,
  asBoolean,
  asEither,
  asJSON,
  asMaybe,
  asNull,
  asNumber,
  asObject,
  asOptional,
  asString,
  asUnknown
} from 'cleaners'

import type { EdgeAsset } from '../../../types'

// Fetching

export interface JsonResponse {
  status: number
  body: unknown
}

/** Fetches a URL and parses the reply as JSON, or returns the raw text. */
export type FetchJson = (
  url: string,
  init?: RequestInit
) => Promise<JsonResponse>

export const fetchJson: FetchJson = async (url, init) => {
  const response = await fetch(url, init)
  const text = await response.text()
  return {
    status: response.status,
    body: asMaybe(asJSON(asUnknown))(text) ?? text
  }
}

export const asNullableString = asEither(asString, asNull)
export const asNullableNumber = asEither(asNumber, asNull)

// CoinGecko

export const asCoingeckoListCoin = asObject({
  id: asString,
  symbol: asString,
  name: asString,
  platforms: asOptional(asObject(asNullableString), {})
})
export const asCoingeckoList = asArray(asUnknown)

export const asCoingeckoSearchCoin = asObject({
  id: asString,
  name: asString,
  symbol: asString,
  market_cap_rank: asOptional(asNullableNumber)
})
export const asCoingeckoSearch = asObject({
  coins: asArray(asUnknown)
})

export const asCoingeckoCoin = asObject({
  id: asString,
  symbol: asString,
  name: asString,
  asset_platform_id: asOptional(asNullableString),
  platforms: asOptional(asObject(asNullableString), {}),
  categories: asOptional(asArray(asNullableString), []),
  links: asOptional(
    asObject({
      homepage: asOptional(asArray(asNullableString), [])
    }),
    { homepage: [] }
  ),
  market_cap_rank: asOptional(asNullableNumber),
  market_data: asOptional(
    asObject({
      current_price: asOptional(asObject(asOptional(asNumber)), {})
    })
  )
})
export type CoingeckoCoin = ReturnType<typeof asCoingeckoCoin>

export const asCoingeckoMarket = asObject({
  id: asString,
  symbol: asString,
  name: asString,
  market_cap_rank: asOptional(asNullableNumber)
})
export const asCoingeckoMarkets = asArray(asUnknown)

// DefiLlama

export const asDefiLlamaPrices = asObject({
  coins: asObject(
    asObject({
      decimals: asOptional(asNumber),
      symbol: asString,
      price: asNumber,
      timestamp: asOptional(asNumber),
      confidence: asOptional(asNumber)
    })
  )
})

// Token lists (Uniswap style `bridgeInfo`, Superchain style `opTokenId`)

export const asTokenListToken = asObject({
  chainId: asNumber,
  address: asString,
  name: asString,
  symbol: asString,
  decimals: asOptional(asNumber),
  extensions: asOptional(
    asObject({
      bridgeInfo: asOptional(asObject(asObject({ tokenAddress: asString }))),
      opTokenId: asOptional(asString)
    })
  )
})
export type TokenListToken = ReturnType<typeof asTokenListToken>
export const asTokenList = asObject({
  name: asOptional(asString),
  tokens: asArray(asUnknown)
})

// Cosmos chain registry

export const asChainRegistryAsset = asObject({
  base: asString,
  symbol: asOptional(asString),
  name: asOptional(asString),
  coingecko_id: asOptional(asString),
  traces: asOptional(
    asArray(
      asObject({
        type: asString,
        counterparty: asOptional(
          asObject({
            chain_name: asOptional(asString),
            base_denom: asOptional(asString)
          })
        )
      })
    ),
    []
  )
})
export const asChainRegistryAssetList = asObject({
  assets: asArray(asUnknown)
})

// Jupiter token search (Solana)

export const asJupiterToken = asObject({
  id: asString,
  name: asString,
  symbol: asString,
  decimals: asOptional(asNumber),
  isVerified: asOptional(asBoolean),
  tags: asOptional(asArray(asString), []),
  organicScore: asOptional(asNumber),
  holderCount: asOptional(asNumber),
  liquidity: asOptional(asNumber)
})
export type JupiterToken = ReturnType<typeof asJupiterToken>
export const asJupiterSearch = asArray(asUnknown)

// GoPlus token security (flags arrive as "0" / "1" strings)

const asGoPlusDex = asObject({
  name: asOptional(asString),
  liquidity: asOptional(asString)
})

export const asGoPlusToken = asObject({
  token_name: asOptional(asString),
  token_symbol: asOptional(asString),
  is_honeypot: asOptional(asString),
  is_open_source: asOptional(asString),
  is_proxy: asOptional(asString),
  is_mintable: asOptional(asString),
  buy_tax: asOptional(asString),
  sell_tax: asOptional(asString),
  cannot_sell_all: asOptional(asString),
  hidden_owner: asOptional(asString),
  owner_change_balance: asOptional(asString),
  is_airdrop_scam: asOptional(asString),
  fake_token: asOptional(
    asObject({
      value: asOptional(asNumber),
      true_token_address: asOptional(asString)
    })
  ),
  trust_list: asOptional(asString),
  holder_count: asOptional(asString),
  lp_holder_count: asOptional(asString),
  is_in_dex: asOptional(asString),
  dex: asOptional(asArray(asGoPlusDex), []),
  creator_percent: asOptional(asString)
})
export type GoPlusToken = ReturnType<typeof asGoPlusToken>
export const asGoPlusResponse = asObject({
  code: asNumber,
  message: asOptional(asString),
  result: asOptional(asObject(asUnknown), {})
})

// RugCheck (Solana)

export const asRugCheckRisk = asObject({
  name: asString,
  level: asOptional(asString),
  description: asOptional(asString),
  score: asOptional(asNumber),
  value: asOptional(asString)
})
export const asRugCheckSummary = asObject({
  score: asOptional(asNumber),
  score_normalised: asOptional(asNumber),
  risks: asOptional(asArray(asRugCheckRisk), []),
  lpLockedPct: asOptional(asNumber)
})
export type RugCheckSummary = ReturnType<typeof asRugCheckSummary>

// Etherscan V2 contract source

export const asEtherscanSourceResponse = asObject({
  status: asString,
  result: asEither(
    asArray(
      asObject({
        SourceCode: asOptional(asString),
        ContractName: asOptional(asString),
        Proxy: asOptional(asString)
      })
    ),
    asString
  )
})

// Issuer registry (data/issuerRegistry.json)

export const asIssuerRegistryCoin = asObject({
  issuer: asString,
  symbol: asString,
  source: asString,
  /** Official issuance by Edge pluginId, in tokenId form. */
  native: asOptional(asObject(asString), {}),
  /** The chain's canonical bridge representation, in tokenId form. */
  canonicalBridged: asOptional(asObject(asString), {})
})
export const asIssuerRegistry = asObject({
  version: asNumber,
  coins: asObject(asIssuerRegistryCoin)
})
export type IssuerRegistry = ReturnType<typeof asIssuerRegistry>

// The gathered bundle

export type Relationship =
  | 'native_issuance'
  | 'canonical_bridge'
  | 'wrapped'
  | 'third_party_bridge'
  | 'other'

export interface EvidenceError {
  source: string
  message: string
}

export interface ChainFacts {
  pluginId: string
  tokenType: string | null
  /** The CoinGecko asset platform id for this chain, when mapped. */
  platformId: string | null
  evmChainId?: number
  defiLlamaSlug?: string
}

export interface SearchHit {
  id: string
  symbol: string
  name: string
  marketCapRank?: number
}

export interface AddressIndexHit extends SearchHit {
  platformId: string
  /** The Edge pluginId the platform maps to, when it does. */
  pluginId?: string
}

export interface CandidateCoin extends SearchHit {
  platforms: Record<string, string>
  homepage: string[]
  categories: string[]
  priceUsd?: number
}

export interface DefiLlamaToken {
  symbol: string
  decimals?: number
  price: number
  confidence?: number
}

export interface TokenListHit {
  list: string
  name: string
  symbol: string
  decimals?: number
  /** Origin tokens this entry bridges from, by EVM chain id. */
  bridgeInfo: Array<{ chainId: number; tokenAddress: string }>
}

export interface ChainRegistryAsset {
  base: string
  symbol?: string
  name?: string
  coingeckoId?: string
  traces: Array<{ type: string; chainName?: string; baseDenom?: string }>
}

export interface IssuerRegistryHit {
  coingeckoId: string
  issuer: string
  symbol: string
  relationship: 'native_issuance' | 'canonical_bridge'
  source: string
}

export interface EtherscanContract {
  verified: boolean
  contractName?: string
  proxy: boolean
}

export interface AssetEvidence {
  key: string
  asset: EdgeAsset
  chain: ChainFacts
  /** The on-chain form of the tokenId, when it can be recovered. */
  address?: string
  coingecko: {
    /** The coin CoinGecko lists at this address on this chain. */
    contract?: CandidateCoin
    /** Coins listing this address on any platform. */
    addressIndex: AddressIndexHit[]
    search: SearchHit[]
    candidates: CandidateCoin[]
  }
  defiLlama?: DefiLlamaToken
  tokenLists: TokenListHit[]
  chainRegistry?: ChainRegistryAsset
  jupiter?: JupiterToken
  issuerRegistry?: IssuerRegistryHit
  goplus?: GoPlusToken
  rugcheck?: RugCheckSummary
  etherscan?: EtherscanContract
  errors: EvidenceError[]
  gatheredAt: string
}
