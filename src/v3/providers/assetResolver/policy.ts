import type { Destination } from './destination'
import type { ProvenanceProof } from './provenance'
import { hasStrongSignal, type ScamSignal } from './scam'
import type { Relationship, Verdict } from './types'

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

export interface GuardResult {
  name: string
  passed: boolean
  detail: string
}

export interface AutoApplyConfig {
  enabled: boolean
  minConfidence: number
  priceParityTolerance: number
  requireIndependentPrice: boolean
  relationships: string[]
  maxPerRun: number
  trustAgentVerdicts: boolean
}

export interface RetryConfig {
  retryDays: number
  scamRecheckDays: number
}

export interface PolicyInput {
  proof?: ProvenanceProof
  signals: ScamSignal[]
  verdict?: Verdict
  destination?: Destination
  /** The destination's current USD rate, when it prices. */
  destinationRate?: number
  /** An independent USD price for the asset itself, from DefiLlama. */
  independentPrice?: number
  ignored: boolean
  /** The key already has a hand-edited crosschain or coingecko entry. */
  manualEntryExists: boolean
  stillUnresolved: boolean
  /** A human is applying by hand; softer guards are waived. */
  forced: boolean
  autoApply: AutoApplyConfig
  appliesThisRun: number
  /** Attempts before this one. */
  attempts: number
  rightNow: Date
  retry: RetryConfig
}

export interface PolicyOutcome {
  status: ProposalStatus
  coingeckoId?: string
  relationship?: Relationship
  confidence?: number
  judge: 'proof' | 'agent' | 'none'
  guards: GuardResult[]
  reasons: string[]
  nextAttemptAfter?: string
}

const dayMs = 24 * 60 * 60 * 1000

const recheckDays = (
  status: ProposalStatus,
  attempts: number,
  retry: RetryConfig
): number | undefined => {
  if (status === 'not_found' || status === 'unsure' || status === 'error') {
    const doublings = Math.max(0, Math.min(attempts, 4) - 1)
    return Math.min(90, retry.retryDays * 2 ** doublings)
  }
  if (status === 'distinct_asset') return 90
  if (status === 'suspected_scam') return retry.scamRecheckDays
}

/** When a status may be looked at again; undefined means on every run. */
export const nextAttemptAfter = (
  status: ProposalStatus,
  attempts: number,
  rightNow: Date,
  retry: RetryConfig
): string | undefined => {
  const days = recheckDays(status, attempts, retry)
  if (days == null) return
  return new Date(rightNow.getTime() + days * dayMs).toISOString()
}

/** Guards a human may waive with `--force`. */
const forceable = new Set([
  'no_weak_signals',
  'deterministic_proof',
  'relationship_allowed',
  'independent_price',
  'price_parity',
  'confidence',
  'auto_apply_enabled',
  'run_cap'
])

export const evaluateGuards = (
  input: PolicyInput,
  claim: {
    coingeckoId: string
    relationship: Relationship
    confidence: number
    judge: 'proof' | 'agent'
  }
): GuardResult[] => {
  const { autoApply, destination, destinationRate, independentPrice } = input
  const weak = input.signals.filter(signal => signal.strength === 'weak')
  const parity =
    independentPrice != null && destinationRate != null && destinationRate > 0
      ? Math.abs(independentPrice - destinationRate) / destinationRate
      : undefined

  const guards: GuardResult[] = [
    {
      name: 'still_unresolved',
      passed: input.stillUnresolved,
      detail: input.stillUnresolved
        ? 'no provider maps the key yet'
        : 'a provider maps the key now'
    },
    {
      name: 'not_ignored',
      passed: !input.ignored,
      detail: input.ignored ? 'on the hand-edited ignore list' : 'not ignored'
    },
    {
      name: 'manual_entry_absent',
      passed: !input.manualEntryExists,
      detail: input.manualEntryExists
        ? 'a hand-edited entry exists for the key'
        : 'no hand-edited entry'
    },
    {
      name: 'dest_priced',
      passed:
        destination != null && destinationRate != null && destinationRate > 0,
      detail:
        destination == null
          ? 'no destination'
          : `destination ${destination.key} rate ${String(destinationRate)}`
    },
    {
      name: 'no_weak_signals',
      passed: weak.length === 0,
      detail:
        weak.length === 0
          ? 'no weak scam signals'
          : weak.map(signal => signal.name).join(', ')
    },
    {
      name: 'deterministic_proof',
      passed: claim.judge === 'proof' || autoApply.trustAgentVerdicts,
      detail:
        claim.judge === 'proof'
          ? 'a scripted source proves the identity'
          : 'only an agent verdict supports the identity'
    },
    {
      name: 'relationship_allowed',
      passed: autoApply.relationships.includes(claim.relationship),
      detail: claim.relationship
    },
    {
      name: 'independent_price',
      passed: independentPrice != null || !autoApply.requireIndependentPrice,
      detail:
        independentPrice == null
          ? 'no independent price'
          : `independent price ${String(independentPrice)}`
    },
    {
      name: 'price_parity',
      passed:
        parity == null
          ? !autoApply.requireIndependentPrice
          : parity <= autoApply.priceParityTolerance,
      detail:
        parity == null
          ? 'no parity check possible'
          : `prices differ by ${String(Math.round(parity * 10000) / 100)}%`
    },
    {
      name: 'confidence',
      passed: claim.confidence >= autoApply.minConfidence,
      detail: `${String(claim.confidence)} against a minimum of ${String(
        autoApply.minConfidence
      )}`
    },
    {
      name: 'auto_apply_enabled',
      passed: autoApply.enabled,
      detail: autoApply.enabled ? 'enabled' : 'disabled by config'
    },
    {
      name: 'run_cap',
      passed: input.appliesThisRun < autoApply.maxPerRun,
      detail: `${String(input.appliesThisRun)} applied this run of ${String(
        autoApply.maxPerRun
      )}`
    }
  ]
  if (!input.forced) return guards
  return guards.map(guard =>
    !guard.passed && forceable.has(guard.name)
      ? { ...guard, passed: true, detail: `${guard.detail} (forced)` }
      : guard
  )
}

/** Turns proof, signals, and verdict into a status, never pricing a scam. */
export const decideProposal = (input: PolicyInput): PolicyOutcome => {
  const { proof, verdict, signals, rightNow, attempts, retry } = input
  const finish = (
    status: ProposalStatus,
    outcome: Omit<PolicyOutcome, 'status' | 'nextAttemptAfter'>
  ): PolicyOutcome => ({
    status,
    ...outcome,
    nextAttemptAfter: nextAttemptAfter(status, attempts + 1, rightNow, retry)
  })

  if (hasStrongSignal(signals) || verdict?.decision === 'suspected_scam') {
    const reasons = signals
      .filter(signal => signal.strength === 'strong')
      .map(signal => signal.name)
    if (verdict?.decision === 'suspected_scam') reasons.push('verdict_scam')
    return finish('suspected_scam', {
      judge: 'none',
      guards: [],
      reasons,
      confidence: verdict?.confidence
    })
  }

  let claim:
    | {
        coingeckoId: string
        relationship: Relationship
        confidence: number
        judge: 'proof' | 'agent'
      }
    | undefined
  if (proof != null) {
    claim = { ...proof, judge: 'proof' }
  } else if (verdict != null) {
    if (verdict.decision === 'same_asset' && verdict.coingeckoId != null) {
      claim = {
        coingeckoId: verdict.coingeckoId,
        relationship: verdict.relationship ?? 'other',
        confidence: verdict.confidence,
        judge: 'agent'
      }
    } else {
      const status: ProposalStatus =
        verdict.decision === 'same_asset' ? 'unsure' : verdict.decision
      return finish(status, {
        judge: 'agent',
        guards: [],
        reasons: [verdict.rationale],
        confidence: verdict.confidence
      })
    }
  } else {
    return finish('awaiting_agent', { judge: 'none', guards: [], reasons: [] })
  }

  if (input.destination == null) {
    return finish('needs_manual_mapping', {
      coingeckoId: claim.coingeckoId,
      relationship: claim.relationship,
      confidence: claim.confidence,
      judge: claim.judge,
      guards: [],
      reasons: [`no Edge asset is priced as ${claim.coingeckoId}`]
    })
  }

  const guards = evaluateGuards(input, claim)
  const failed = guards.filter(guard => !guard.passed)
  return finish(failed.length === 0 ? 'applied' : 'proposed', {
    coingeckoId: claim.coingeckoId,
    relationship: claim.relationship,
    confidence: claim.confidence,
    judge: claim.judge,
    guards,
    reasons: failed.map(guard => guard.name)
  })
}
