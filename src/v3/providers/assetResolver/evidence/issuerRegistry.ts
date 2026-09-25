import registryJson from '../../../../../data/issuerRegistry.json'
import {
  asIssuerRegistry,
  type IssuerRegistry,
  type IssuerRegistryHit
} from './types'

/**
 * Official issuer deployments and canonical bridge representations of the
 * major assets, hand-maintained in `data/issuerRegistry.json` from the
 * issuers' published address pages. Cleaned once at import.
 */
export const issuerRegistry: IssuerRegistry = asIssuerRegistry(registryJson)

/** The registry entry that names this exact asset, if any. */
export const lookupIssuerRegistry = (
  registry: IssuerRegistry,
  pluginId: string,
  tokenId: string | null | undefined
): IssuerRegistryHit | undefined => {
  if (tokenId == null) return
  const wanted = tokenId.toLowerCase()
  for (const [coingeckoId, coin] of Object.entries(registry.coins)) {
    const hit = {
      coingeckoId,
      issuer: coin.issuer,
      symbol: coin.symbol,
      source: coin.source
    }
    if (coin.native[pluginId]?.toLowerCase() === wanted) {
      return { ...hit, relationship: 'native_issuance' }
    }
    if (coin.canonicalBridged[pluginId]?.toLowerCase() === wanted) {
      return { ...hit, relationship: 'canonical_bridge' }
    }
  }
}
