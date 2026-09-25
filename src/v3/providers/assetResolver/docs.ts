import {
  asMaybe,
  asNumber,
  asObject,
  asValue,
  type Cleaner,
  uncleaner
} from 'cleaners'
import { asCouchDoc } from 'edge-server-tools'

import { snooze } from '../../../utils/utils'
import {
  asCrossChainMapping,
  asNumberMap,
  asStringNullMap,
  asTokenMap,
  asTokenTypeMap,
  type CrossChainMapping,
  type NumberMap,
  type TokenMap
} from '../../types'
import { coingeckoMainnetCurrencyMapping } from '../coingecko/defaultPluginIdMapping'
import { coinmarketcapMainnetCurrencyMapping } from '../coinmarketcap/defaultPluginIdMapping'
import { dbSettings } from '../couch'
import type { ClassifierContext } from './classify'
import {
  asBatchMap,
  asIgnoreMap,
  asProposalMap,
  type BatchRecord,
  type CrossChainEntry,
  type IgnoreMap,
  type Proposal,
  type ProposalMap
} from './types'

const asNotFoundError = asObject({ statusCode: asValue(404) })
const asConflictError = asObject({ statusCode: asValue(409) })

/** The slice of a nano document scope the resolver uses; injectable for tests. */
export interface SettingsDb {
  get: (id: string) => Promise<unknown>
  insert: (doc: unknown) => Promise<unknown>
}
const defaultDb: SettingsDb = dbSettings

/** Reads a `rates_settings` document, treating a missing one as the fallback. */
export const readSettingsDoc = async <T>(
  id: string,
  cleaner: Cleaner<T>,
  fallback: T,
  db: SettingsDb = defaultDb
): Promise<T> => {
  let raw: unknown
  try {
    raw = await db.get(id)
  } catch (error: unknown) {
    if (asMaybe(asNotFoundError)(error) != null) return fallback
    throw error
  }
  return asCouchDoc(cleaner)(raw).doc
}

/**
 * Reads a document fresh, applies `mutate`, and writes it back with the
 * revision just read, retrying on a conflict. Never uses a cached revision.
 */
export const updateSettingsDoc = async <T>(
  id: string,
  cleaner: Cleaner<T>,
  mutate: (doc: T) => T,
  db: SettingsDb = defaultDb
): Promise<T> => {
  const wasDoc = uncleaner(asCouchDoc(cleaner))
  for (let attempt = 0; ; attempt++) {
    let rev: string | undefined
    let doc: T
    try {
      const raw = asCouchDoc(cleaner)(await db.get(id))
      rev = raw.rev
      doc = raw.doc
    } catch (error: unknown) {
      if (asMaybe(asNotFoundError)(error) == null) throw error
      doc = cleaner({})
    }
    const next = mutate(doc)
    try {
      await db.insert(wasDoc({ id, rev, doc: next }))
      return next
    } catch (error: unknown) {
      if (asMaybe(asConflictError)(error) == null || attempt >= 3) throw error
      await snooze(250 * (attempt + 1))
    }
  }
}

const asConstantRates = asObject(asNumber)

const nonNullKeys = (map: Record<string, unknown>): string[] =>
  Object.keys(map).filter(key => map[key] != null)

export interface ResolverDocs {
  context: ClassifierContext
  /** The coingecko documents merged, hand-edited last. */
  coingeckoMap: TokenMap
  manualCoingecko: TokenMap
  manualCrossChain: CrossChainMapping
  automatedCrossChain: CrossChainMapping
  aiCrossChain: CrossChainMapping
  platformPriority: NumberMap
  proposals: ProposalMap
  ignore: IgnoreMap
  ignoreWarning?: string
}

/**
 * Reads every document the resolver needs, fresh from CouchDB.
 * The mainnet defaults count as mapped because the providers hold them in
 * memory before the first daily sweep writes them to the automated documents.
 */
export const loadResolverDocs = async (): Promise<ResolverDocs> => {
  const [
    tokenTypes,
    platforms,
    manualCoingecko,
    coingeckoAutomated,
    coinmarketcap,
    coinmarketcapAutomated,
    constantRates,
    manualCrossChain,
    automatedCrossChain,
    aiCrossChain,
    platformPriority,
    proposals,
    { ignore, warning: ignoreWarning }
  ] = await Promise.all([
    readSettingsDoc('tokenTypes', asTokenTypeMap, {}),
    readSettingsDoc('coingecko:platforms', asStringNullMap, {}),
    readSettingsDoc('coingecko', asTokenMap, {}),
    readSettingsDoc('coingecko:automated', asTokenMap, {}),
    readSettingsDoc('coinmarketcap', asTokenMap, {}),
    readSettingsDoc('coinmarketcap:automated', asTokenMap, {}),
    readSettingsDoc('constantrates', asConstantRates, {}),
    readSettingsDoc('crosschain', asCrossChainMapping, {}),
    readSettingsDoc('crosschain:automated', asCrossChainMapping, {}),
    readSettingsDoc('crosschain:ai', asCrossChainMapping, {}),
    readSettingsDoc('platformPriority', asNumberMap, {}),
    readSettingsDoc('assetResolver:proposals', asProposalMap, {}),
    loadIgnoreMap()
  ])

  const mappedKeys = new Set<string>([
    ...nonNullKeys(coingeckoMainnetCurrencyMapping),
    ...nonNullKeys(coinmarketcapMainnetCurrencyMapping),
    ...Object.keys(manualCoingecko),
    ...Object.keys(coingeckoAutomated),
    ...Object.keys(coinmarketcap),
    ...Object.keys(coinmarketcapAutomated),
    ...Object.keys(constantRates)
  ])
  return {
    context: {
      tokenTypes,
      platforms,
      mappedKeys,
      crossChain: {
        ...automatedCrossChain,
        ...aiCrossChain,
        ...manualCrossChain
      }
    },
    coingeckoMap: { ...coingeckoAutomated, ...manualCoingecko },
    manualCoingecko,
    manualCrossChain,
    automatedCrossChain,
    aiCrossChain,
    platformPriority,
    proposals,
    ignore,
    ignoreWarning
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

export const saveProposals = async (
  updates: Map<string, Proposal>
): Promise<void> => {
  if (updates.size === 0) return
  await updateSettingsDoc('assetResolver:proposals', asProposalMap, doc => {
    for (const [key, proposal] of updates) doc[key] = proposal
    return doc
  })
}

export const saveBatchRecord = async (
  batchId: string,
  record: {
    status: BatchRecord['status']
    createdAt: string
    assetCount: number
    runDir?: string
    verdictCount?: number
    error?: string
  }
): Promise<void> => {
  await updateSettingsDoc('assetResolver:batches', asBatchMap, doc => {
    doc[batchId] = {
      status: record.status,
      createdAt: record.createdAt,
      assetCount: record.assetCount,
      runDir: record.runDir,
      verdictCount: record.verdictCount,
      error: record.error
    }
    return doc
  })
}

/**
 * Writes one machine-made cross-chain entry, failing closed if a hand-edited
 * document already names the key.
 */
export const applyCrossChainEntry = async (
  key: string,
  entry: CrossChainEntry,
  db: SettingsDb = defaultDb
): Promise<void> => {
  const [manualCrossChain, manualCoingecko] = await Promise.all([
    readSettingsDoc('crosschain', asCrossChainMapping, {}, db),
    readSettingsDoc('coingecko', asTokenMap, {}, db)
  ])
  if (manualCrossChain[key] != null || manualCoingecko[key] != null) {
    throw new Error(`A hand-edited entry exists for ${key}; not applying`)
  }
  await updateSettingsDoc(
    'crosschain:ai',
    asCrossChainMapping,
    doc => {
      doc[key] = entry
      return doc
    },
    db
  )
}

export const removeCrossChainEntry = async (
  key: string,
  db: SettingsDb = defaultDb
): Promise<boolean> => {
  let removed = false
  await updateSettingsDoc(
    'crosschain:ai',
    asCrossChainMapping,
    doc => {
      if (doc[key] != null) {
        removed = true
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete doc[key]
      }
      return doc
    },
    db
  )
  return removed
}

export const removeIgnoreEntry = async (key: string): Promise<boolean> => {
  let removed = false
  await updateSettingsDoc('assetResolver', asIgnoreMap, doc => {
    if (doc[key] != null) {
      removed = true
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete doc[key]
    }
    return doc
  })
  return removed
}

export const addIgnoreEntry = async (
  key: string,
  reason: string,
  until?: string
): Promise<void> => {
  await updateSettingsDoc('assetResolver', asIgnoreMap, doc => {
    doc[key] = { reason, until }
    return doc
  })
}
