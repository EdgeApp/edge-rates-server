/** EVM chain ids by Edge pluginId, matching CoinGecko's `chain_identifier`. */
export const evmChainIds: Record<string, number> = {
  abstract: 2741,
  arbitrum: 42161,
  avalanche: 43114,
  base: 8453,
  binancesmartchain: 56,
  bobevm: 60808,
  botanix: 3637,
  celo: 42220,
  ethereum: 1,
  ethereumclassic: 61,
  fantom: 250,
  filecoinfevm: 314,
  hyperevm: 999,
  monad: 143,
  opbnb: 204,
  optimism: 10,
  polygon: 137,
  pulsechain: 369,
  robinhood: 4663,
  rsk: 30,
  sonic: 146,
  zksync: 324
}

/** DefiLlama chain slugs by Edge pluginId. */
export const defiLlamaChainSlugs: Record<string, string> = {
  abstract: 'abstract',
  arbitrum: 'arbitrum',
  avalanche: 'avax',
  base: 'base',
  binancesmartchain: 'bsc',
  bobevm: 'bob',
  celo: 'celo',
  cosmoshub: 'cosmos',
  ethereum: 'ethereum',
  fantom: 'fantom',
  filecoinfevm: 'filecoin',
  hyperevm: 'hyperliquid',
  monad: 'monad',
  opbnb: 'op_bnb',
  optimism: 'optimism',
  osmosis: 'osmosis',
  polygon: 'polygon',
  pulsechain: 'pulse',
  rsk: 'rsk',
  solana: 'solana',
  sonic: 'sonic',
  sui: 'sui',
  ton: 'ton',
  tron: 'tron',
  zksync: 'era'
}

/** Cosmos chain-registry directory names by Edge pluginId. */
export const cosmosRegistryChains: Record<string, string> = {
  axelar: 'axelar',
  coreum: 'coreum',
  cosmoshub: 'cosmoshub',
  osmosis: 'osmosis',
  thorchainrune: 'thorchain'
}

/**
 * Recovers the on-chain form of a tokenId, the inverse of `createTokenId`.
 * EVM ids get their `0x` back; cosmos IBC denoms get their slash back;
 * sui ids lose their `::` separators when created, so they cannot be
 * recovered.
 */
export const tokenIdToAddress = (
  tokenType: string | null,
  tokenId: string
): string | undefined => {
  switch (tokenType) {
    case 'evm':
      return `0x${tokenId}`
    case 'simple':
    case 'lowercase':
    case 'xrpl':
      return tokenId
    case 'cosmos':
      return /^ibc[0-9A-F]{64}$/.test(tokenId)
        ? `ibc/${tokenId.slice(3)}`
        : tokenId
    default:
      return undefined
  }
}
