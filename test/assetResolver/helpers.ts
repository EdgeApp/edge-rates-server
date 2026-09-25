import type {
  AssetEvidence,
  SearchHit
} from '../../src/v3/providers/assetResolver/evidence/types'

/** Evidence for a polygon token with nothing found yet; override as needed. */
export const makeEvidence = (
  overrides: Partial<AssetEvidence> = {}
): AssetEvidence => ({
  key: 'polygon_2791bca1f2de4661ed88a30c99a7a9449aa84174',
  asset: {
    pluginId: 'polygon',
    tokenId: '2791bca1f2de4661ed88a30c99a7a9449aa84174'
  },
  chain: {
    pluginId: 'polygon',
    tokenType: 'evm',
    platformId: 'polygon-pos',
    evmChainId: 137,
    defiLlamaSlug: 'polygon'
  },
  address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
  coingecko: { addressIndex: [], search: [], candidates: [] },
  tokenLists: [],
  errors: [],
  gatheredAt: '2026-09-25T16:00:00.000Z',
  ...overrides
})

export const topCoins: SearchHit[] = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', marketCapRank: 1 },
  { id: 'usd-coin', symbol: 'usdc', name: 'USDC', marketCapRank: 6 },
  { id: 'tether', symbol: 'usdt', name: 'Tether', marketCapRank: 3 },
  { id: 'obscure', symbol: 'obs', name: 'Obscure', marketCapRank: 900 }
]
