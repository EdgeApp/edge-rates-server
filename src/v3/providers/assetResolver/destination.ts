import type { EdgeAsset, NumberMap, TokenMap } from '../../types'
import { fromCryptoKey } from '../../utils'

export interface DestinationContext {
  /** The coingecko documents merged, hand-edited last. */
  coingeckoMap: TokenMap
  /** Keys that are cross-chain sources; the router follows only one hop. */
  crossChainSources: Set<string>
  /** The `platformPriority` document. */
  platformPriority: NumberMap
}

export interface Destination {
  key: string
  asset: EdgeAsset
  priority: number
}

/** Every priced Edge asset key with its CoinGecko id, for provenance checks. */
export const buildMappedAssets = (
  coingeckoMap: TokenMap
): Map<string, string> => {
  const out = new Map<string, string>()
  for (const [key, entry] of Object.entries(coingeckoMap))
    out.set(key, entry.id)
  return out
}

/**
 * The Edge asset a cross-chain entry should point at for a CoinGecko id:
 * the highest-priority chain that maps the id and is not itself a
 * cross-chain source.
 */
export const deriveDestination = (
  coingeckoId: string,
  context: DestinationContext
): Destination | undefined => {
  const candidates: Destination[] = []
  for (const [key, entry] of Object.entries(context.coingeckoMap)) {
    if (entry.id !== coingeckoId) continue
    if (context.crossChainSources.has(key)) continue
    const asset = fromCryptoKey(key)
    candidates.push({
      key,
      asset: { pluginId: asset.pluginId, tokenId: asset.tokenId ?? null },
      priority:
        context.platformPriority[asset.pluginId] ?? Number.MAX_SAFE_INTEGER
    })
  }
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.key.localeCompare(b.key)
  })
  return candidates[0]
}
