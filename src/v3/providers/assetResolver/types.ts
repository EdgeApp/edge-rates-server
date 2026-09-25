import {
  asArray,
  asBoolean,
  asEither,
  asNull,
  asNumber,
  asObject,
  asOptional,
  asString,
  type Cleaner
} from 'cleaners'

import { asEdgeAsset } from '../../types'

/**
 * One entry of the hand-edited `assetResolver` document, keyed by
 * `pluginId_tokenId`. The asset stays out of reports and resolution until the
 * `until` day (YYYY-MM-DD, UTC), or forever when `until` is omitted.
 */
export const asIgnoreEntry = asObject({
  reason: asString,
  until: asOptional(asString)
})
export type IgnoreEntry = ReturnType<typeof asIgnoreEntry>

export const asIgnoreMap = asObject(asIgnoreEntry)
export type IgnoreMap = ReturnType<typeof asIgnoreMap>

// Agent verdicts (docs/asset-resolver/INSTRUCTIONS.md)

/** Accepts one of a fixed set of strings, keeping the literal type. */
export const asOneOf =
  <T extends string>(values: readonly T[]): Cleaner<T> =>
  raw => {
    const value = asString(raw)
    const match = values.find(candidate => candidate === value)
    if (match == null) {
      throw new TypeError(`Expected one of ${values.join(', ')}`)
    }
    return match
  }

export type Decision =
  | 'same_asset'
  | 'distinct_asset'
  | 'not_found'
  | 'suspected_scam'
  | 'unsure'
export const asDecision = asOneOf<Decision>([
  'same_asset',
  'distinct_asset',
  'not_found',
  'suspected_scam',
  'unsure'
])

export type Relationship =
  | 'native_issuance'
  | 'canonical_bridge'
  | 'wrapped'
  | 'third_party_bridge'
  | 'other'
export const asRelationship = asOneOf<Relationship>([
  'native_issuance',
  'canonical_bridge',
  'wrapped',
  'third_party_bridge',
  'other'
])

export type EvidenceSupport = 'same' | 'distinct' | 'scam' | 'neutral'
export const asEvidenceSupport = asOneOf<EvidenceSupport>([
  'same',
  'distinct',
  'scam',
  'neutral'
])

/** A probability, clamped into [0, 1]. */
export const asUnitInterval: Cleaner<number> = raw => {
  const value = asNumber(raw)
  if (Number.isNaN(value)) throw new TypeError('Expected a number')
  return Math.min(1, Math.max(0, value))
}

export const asVerdictEvidence = asObject({
  source: asString,
  url: asOptional(asEither(asString, asNull)),
  claim: asString,
  supports: asEvidenceSupport,
  primary: asOptional(asBoolean, false)
})

export const asVerdict = asObject({
  key: asString,
  decision: asDecision,
  coingeckoId: asOptional(asEither(asString, asNull)),
  relationship: asOptional(asEither(asRelationship, asNull)),
  confidence: asUnitInterval,
  issuer: asOptional(asEither(asString, asNull)),
  rationale: asString,
  evidence: asOptional(asArray(asVerdictEvidence), []),
  scamIndicators: asOptional(asArray(asString), [])
})
export type Verdict = ReturnType<typeof asVerdict>

// Proposals (the `assetResolver:proposals` document)

export type ProposalStatus =
  | 'applied'
  | 'proposed'
  | 'suspected_scam'
  | 'needs_manual_mapping'
  | 'awaiting_agent'
  | 'distinct_asset'
  | 'not_found'
  | 'unsure'
  | 'error'
  | 'superseded'
  | 'rolled_back'
export const asProposalStatus = asOneOf<ProposalStatus>([
  'applied',
  'proposed',
  'suspected_scam',
  'needs_manual_mapping',
  'awaiting_agent',
  'distinct_asset',
  'not_found',
  'unsure',
  'error',
  'superseded',
  'rolled_back'
])

export const asGuardResult = asObject({
  name: asString,
  passed: asBoolean,
  detail: asString
})

export const asScamSignal = asObject({
  name: asString,
  strength: asOneOf<'strong' | 'weak'>(['strong', 'weak']),
  detail: asString
})

export const asProvenanceProof = asObject({
  kind: asString,
  coingeckoId: asString,
  relationship: asRelationship,
  confidence: asNumber,
  detail: asString
})

export const asJudgeVerdict = asObject({
  kind: asString,
  model: asString,
  probability: asNumber
})

export const asCrossChainEntry = asObject({
  sourceChain: asString,
  destChain: asString,
  currencyCode: asString,
  tokenId: asEither(asString, asNull)
})
export type CrossChainEntry = ReturnType<typeof asCrossChainEntry>

export const asProposal = asObject({
  asset: asEdgeAsset,
  assetClass: asString,
  status: asProposalStatus,
  coingeckoId: asOptional(asString),
  relationship: asOptional(asRelationship),
  confidence: asOptional(asNumber),
  judge: asOptional(asJudgeVerdict),
  shadowJudge: asOptional(asJudgeVerdict),
  provenance: asOptional(asProvenanceProof),
  scamSignals: asOptional(asArray(asScamSignal), []),
  guards: asOptional(asArray(asGuardResult), []),
  reasons: asOptional(asArray(asString), []),
  destination: asOptional(asObject({ key: asString, asset: asEdgeAsset })),
  verdict: asOptional(asVerdict),
  batchId: asOptional(asString),
  instructionsVersion: asOptional(asNumber),
  agent: asOptional(asObject({ name: asString, model: asOptional(asString) })),
  requestCount: asOptional(asNumber),
  /** Research attempts so far, including the one that wrote this record. */
  attempts: asNumber,
  firstSeen: asString,
  lastAttempt: asString,
  nextAttemptAfter: asOptional(asString),
  appliedAt: asOptional(asString),
  rolledBackAt: asOptional(asString),
  appliedEntry: asOptional(asCrossChainEntry),
  error: asOptional(asString)
})
export type Proposal = ReturnType<typeof asProposal>
export const asProposalMap = asObject(asProposal)
export type ProposalMap = ReturnType<typeof asProposalMap>

// Batches (the `assetResolver:batches` document)

export const asBatchStatus = asOneOf<
  'exported' | 'running' | 'ingested' | 'agent_error'
>(['exported', 'running', 'ingested', 'agent_error'])
export const asBatchRecord = asObject({
  status: asBatchStatus,
  createdAt: asString,
  runDir: asOptional(asString),
  assetCount: asNumber,
  verdictCount: asOptional(asNumber),
  error: asOptional(asString)
})
export type BatchRecord = ReturnType<typeof asBatchRecord>
export const asBatchMap = asObject(asBatchRecord)
export type BatchMap = ReturnType<typeof asBatchMap>
