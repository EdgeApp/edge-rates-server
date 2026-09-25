import {
  asArray,
  asJSON,
  asNumber,
  asObject,
  asOptional,
  asString
} from 'cleaners'

import type { EdgeAsset } from '../../types'
import type { UnresolvedAssetClass } from './classify'
import type { AssetEvidence, CandidateCoin } from './evidence/types'
import type { ScamSignal } from './scam'
import { asVerdict, type Verdict } from './types'

/** Bump when INSTRUCTIONS.md changes in a way that affects verdicts. */
export const instructionsVersion = 1

export interface BatchCandidate extends CandidateCoin {
  /** The Edge asset a mapping would point at, when Edge prices this coin. */
  destination?: { key: string; asset: EdgeAsset; usdRate?: number }
  /** DefiLlama's price for the asset against the destination rate. */
  priceDelta?: number
}

export interface BatchEntry {
  key: string
  asset: EdgeAsset
  assetClass: UnresolvedAssetClass
  requestCount: number
  evidence: AssetEvidence
  scamSignals: ScamSignal[]
  candidates: BatchCandidate[]
}

export interface BatchFile {
  batchId: string
  instructionsVersion: number
  createdAt: string
  entries: BatchEntry[]
}

/** A filesystem-safe id from the time the batch was built. */
export const makeBatchId = (rightNow: Date): string =>
  rightNow.toISOString().slice(0, 19).replace(/[:T]/g, '-')

export const buildBatch = (
  entries: BatchEntry[],
  rightNow: Date
): BatchFile => ({
  batchId: makeBatchId(rightNow),
  instructionsVersion,
  createdAt: rightNow.toISOString(),
  entries
})

export const asVerdictsFile = asObject({
  batchId: asString,
  instructionsVersion: asNumber,
  agent: asOptional(
    asObject({
      name: asString,
      model: asOptional(asString),
      startedAt: asOptional(asString),
      finishedAt: asOptional(asString)
    })
  ),
  verdicts: asArray(asVerdict)
})
export type VerdictsFile = ReturnType<typeof asVerdictsFile>

/**
 * Parses a verdicts file and checks it answers this batch: same id and
 * instructions version, every key from the batch, no strangers, no repeats.
 */
export const parseVerdictsFile = (
  text: string,
  batch: { batchId: string; instructionsVersion: number; keys: string[] }
): VerdictsFile => {
  const file = asJSON(asVerdictsFile)(text)
  if (file.batchId !== batch.batchId) {
    throw new Error(
      `Verdicts are for batch ${file.batchId}, not ${batch.batchId}`
    )
  }
  if (file.instructionsVersion !== batch.instructionsVersion) {
    throw new Error(
      `Verdicts follow instructions version ${String(
        file.instructionsVersion
      )}, expected ${String(batch.instructionsVersion)}`
    )
  }
  const seen = new Set<string>()
  for (const verdict of file.verdicts) {
    if (!batch.keys.includes(verdict.key)) {
      throw new Error(`Verdict for ${verdict.key} is not in the batch`)
    }
    if (seen.has(verdict.key)) {
      throw new Error(`Duplicate verdict for ${verdict.key}`)
    }
    seen.add(verdict.key)
  }
  return file
}

/** Verdicts by key, for joining back to the batch. */
export const indexVerdicts = (file: VerdictsFile): Map<string, Verdict> =>
  new Map(file.verdicts.map(verdict => [verdict.key, verdict]))
