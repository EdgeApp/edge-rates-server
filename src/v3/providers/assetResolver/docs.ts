import { asMaybe, asNumber, asObject, asValue, type Cleaner } from 'cleaners'
import { asCouchDoc } from 'edge-server-tools'

import {
  asCrossChainMapping,
  asStringNullMap,
  asTokenMap,
  asTokenTypeMap
} from '../../types'
import { coingeckoMainnetCurrencyMapping } from '../coingecko/defaultPluginIdMapping'
import { coinmarketcapMainnetCurrencyMapping } from '../coinmarketcap/defaultPluginIdMapping'
import { dbSettings } from '../couch'
import type { ClassifierContext } from './classify'
import { asIgnoreMap, type IgnoreMap } from './types'

const asNotFoundError = asObject({ statusCode: asValue(404) })

/** Reads a `rates_settings` document, treating a missing one as the fallback. */
export const readSettingsDoc = async <T>(
  id: string,
  cleaner: Cleaner<T>,
  fallback: T
): Promise<T> => {
  let raw: unknown
  try {
    raw = await dbSettings.get(id)
  } catch (error: unknown) {
    if (asMaybe(asNotFoundError)(error) != null) return fallback
    throw error
  }
  return asCouchDoc(cleaner)(raw).doc
}

const asConstantRates = asObject(asNumber)

const nonNullKeys = (map: Record<string, unknown>): string[] =>
  Object.keys(map).filter(key => map[key] != null)

/**
 * Reads the documents the classifier needs, fresh from CouchDB.
 * The mainnet defaults count as mapped because the providers hold them in
 * memory before the first daily sweep writes them to the automated documents.
 */
export const loadClassifierContext = async (): Promise<ClassifierContext> => {
  const [
    tokenTypes,
    platforms,
    coingecko,
    coingeckoAutomated,
    coinmarketcap,
    coinmarketcapAutomated,
    constantRates,
    crossChain,
    crossChainAutomated
  ] = await Promise.all([
    readSettingsDoc('tokenTypes', asTokenTypeMap, {}),
    readSettingsDoc('coingecko:platforms', asStringNullMap, {}),
    readSettingsDoc('coingecko', asTokenMap, {}),
    readSettingsDoc('coingecko:automated', asTokenMap, {}),
    readSettingsDoc('coinmarketcap', asTokenMap, {}),
    readSettingsDoc('coinmarketcap:automated', asTokenMap, {}),
    readSettingsDoc('constantrates', asConstantRates, {}),
    readSettingsDoc('crosschain', asCrossChainMapping, {}),
    readSettingsDoc('crosschain:automated', asCrossChainMapping, {})
  ])

  const mappedKeys = new Set<string>([
    ...nonNullKeys(coingeckoMainnetCurrencyMapping),
    ...nonNullKeys(coinmarketcapMainnetCurrencyMapping),
    ...Object.keys(coingecko),
    ...Object.keys(coingeckoAutomated),
    ...Object.keys(coinmarketcap),
    ...Object.keys(coinmarketcapAutomated),
    ...Object.keys(constantRates)
  ])
  return {
    tokenTypes,
    platforms,
    mappedKeys,
    crossChain: { ...crossChainAutomated, ...crossChain }
  }
}

/** Reads the hand-edited ignore list. A malformed document silences nothing. */
export const loadIgnoreMap = async (): Promise<{
  ignore: IgnoreMap
  warning?: string
}> => {
  try {
    return { ignore: await readSettingsDoc('assetResolver', asIgnoreMap, {}) }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ignore: {},
      warning: `The assetResolver document could not be read, so nothing is silenced: ${message}`
    }
  }
}
