import type { AssetEvidence } from './evidence/types'
import { evmChainIds } from './tokenAddress'
import type { Relationship } from './types'

export type ProofKind =
  | 'issuer_registry'
  | 'canonical_bridge_list'
  | 'coingecko_address'
  | 'chain_registry'

export interface ProvenanceProof {
  kind: ProofKind
  coingeckoId: string
  relationship: Relationship
  confidence: number
  detail: string
}

/** Fixed confidence per proof, the deterministic judge. */
export const proofConfidence: Record<ProofKind, number> = {
  issuer_registry: 0.99,
  canonical_bridge_list: 0.98,
  coingecko_address: 0.97,
  chain_registry: 0.95
}

const pluginIdsByChainId: Record<number, string> = {}
for (const [pluginId, chainId] of Object.entries(evmChainIds)) {
  pluginIdsByChainId[chainId] = pluginId
}

/**
 * A deterministic answer to "which CoinGecko coin is this asset", from the
 * strongest source available. `mappedAssets` maps every Edge asset key the
 * provider docs price to its CoinGecko id.
 */
export const findProvenance = (
  evidence: AssetEvidence,
  mappedAssets: Map<string, string>
): ProvenanceProof | undefined => {
  const { issuerRegistry, tokenLists, chainRegistry, coingecko, chain } =
    evidence

  if (issuerRegistry != null) {
    return {
      kind: 'issuer_registry',
      coingeckoId: issuerRegistry.coingeckoId,
      relationship: issuerRegistry.relationship,
      confidence: proofConfidence.issuer_registry,
      detail: `${issuerRegistry.issuer} lists this address (${issuerRegistry.source})`
    }
  }

  for (const hit of tokenLists) {
    for (const origin of hit.bridgeInfo) {
      const originPluginId = pluginIdsByChainId[origin.chainId]
      if (originPluginId == null) continue
      const originKey = `${originPluginId}_${origin.tokenAddress
        .toLowerCase()
        .replace(/^0x/, '')}`
      const coingeckoId = mappedAssets.get(originKey)
      if (coingeckoId == null) continue
      return {
        kind: 'canonical_bridge_list',
        coingeckoId,
        relationship: 'canonical_bridge',
        confidence: proofConfidence.canonical_bridge_list,
        detail: `The ${hit.list} token list bridges it from ${originKey}`
      }
    }
  }

  const listed =
    coingecko.contract ??
    coingecko.addressIndex.find(hit => hit.pluginId === chain.pluginId)
  if (listed != null) {
    return {
      kind: 'coingecko_address',
      coingeckoId: listed.id,
      relationship: 'native_issuance',
      confidence: proofConfidence.coingecko_address,
      detail: `CoinGecko lists this address under ${listed.id} on this chain`
    }
  }

  if (chainRegistry?.coingeckoId != null) {
    const bridged = chainRegistry.traces.some(trace => trace.type === 'ibc')
    return {
      kind: 'chain_registry',
      coingeckoId: chainRegistry.coingeckoId,
      relationship: bridged ? 'canonical_bridge' : 'native_issuance',
      confidence: proofConfidence.chain_registry,
      detail: `The cosmos chain registry maps the denom to ${chainRegistry.coingeckoId}`
    }
  }
}
