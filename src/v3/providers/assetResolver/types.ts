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
