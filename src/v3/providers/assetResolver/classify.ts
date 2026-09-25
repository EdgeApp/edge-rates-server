import type { CrossChainMapping, StringNullMap } from '../../types'
import { fromCryptoKey, toCryptoKey } from '../../utils'
import type { IgnoreEntry } from './types'

export type UnresolvedAssetClass =
  | 'mapped-unpriced'
  | 'v2-unknown-code'
  | 'unknown-plugin'
  | 'unmapped-native'
  | 'chain-tokens-unsupported'
  | 'unmapped-token'

export interface ClassifierContext {
  /** The `tokenTypes` document: a token type per chain, or null. */
  tokenTypes: StringNullMap
  /** The `coingecko:platforms` document. */
  platforms: StringNullMap
  /** Every key a provider or the constant-rates document maps today. */
  mappedKeys: Set<string>
  /** The cross-chain documents merged with the hand-edited one last. */
  crossChain: CrossChainMapping
}

const hasOwn = (object: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(object, key)

/** Follows the single cross-chain hop the router applies before any provider. */
export const toCanonicalKey = (
  crossChain: CrossChainMapping,
  key: string
): string => {
  const cross = crossChain[key]
  if (cross == null) return key
  return toCryptoKey({ pluginId: cross.destChain, tokenId: cross.tokenId })
}

export const isMappedNow = (context: ClassifierContext, key: string): boolean =>
  context.mappedKeys.has(toCanonicalKey(context.crossChain, key))

export const classifyUnresolvedAsset = (
  context: ClassifierContext,
  key: string
): UnresolvedAssetClass => {
  if (isMappedNow(context, key)) return 'mapped-unpriced'

  const { pluginId, tokenId } = fromCryptoKey(key)
  const knownPlugin =
    hasOwn(context.tokenTypes, pluginId) || hasOwn(context.platforms, pluginId)
  if (!knownPlugin) {
    // The v2 converter fabricates an upper-case pluginId for unknown codes:
    return tokenId == null && !/[a-z]/.test(pluginId)
      ? 'v2-unknown-code'
      : 'unknown-plugin'
  }
  if (tokenId == null) return 'unmapped-native'
  if (
    context.tokenTypes[pluginId] == null ||
    context.platforms[pluginId] == null
  ) {
    return 'chain-tokens-unsupported'
  }
  return 'unmapped-token'
}

/**
 * True while a hand-edited ignore entry applies. An `until` day that does not
 * parse never silences an asset, so a typo shows up in the report.
 */
export const isIgnored = (
  entry: IgnoreEntry | undefined,
  rightNow: Date
): boolean => {
  if (entry == null) return false
  if (entry.until == null || entry.until === '') return true
  const until = new Date(entry.until)
  if (isNaN(until.valueOf())) return false
  return until > rightNow
}
