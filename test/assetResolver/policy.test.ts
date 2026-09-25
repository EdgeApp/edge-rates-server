import { assert } from 'chai'
import { describe, it } from 'mocha'

import {
  decideProposal,
  nextAttemptAfter,
  type PolicyInput
} from '../../src/v3/providers/assetResolver/policy'
import type { ProvenanceProof } from '../../src/v3/providers/assetResolver/provenance'
import type { Verdict } from '../../src/v3/providers/assetResolver/types'

const rightNow = new Date('2026-09-25T16:00:00.000Z')
const proof: ProvenanceProof = {
  kind: 'issuer_registry',
  coingeckoId: 'usd-coin',
  relationship: 'canonical_bridge',
  confidence: 0.99,
  detail: 'Circle lists this address'
}
const sameAsset: Verdict = {
  key: 'polygon_2791',
  decision: 'same_asset',
  coingeckoId: 'usd-coin',
  relationship: 'canonical_bridge',
  confidence: 0.93,
  issuer: 'Circle',
  rationale: 'Bridged USDC per the Polygon docs',
  evidence: [],
  scamIndicators: []
}
const base: PolicyInput = {
  signals: [],
  destination: {
    key: 'ethereum_a0b8',
    asset: { pluginId: 'ethereum', tokenId: 'a0b8' },
    priority: 20
  },
  destinationRate: 0.9998,
  independentPrice: 0.9996,
  ignored: false,
  manualEntryExists: false,
  stillUnresolved: true,
  forced: false,
  autoApply: {
    enabled: true,
    minConfidence: 0.95,
    priceParityTolerance: 0.03,
    requireIndependentPrice: true,
    relationships: ['native_issuance', 'canonical_bridge'],
    maxPerRun: 5,
    trustAgentVerdicts: false
  },
  appliesThisRun: 0,
  attempts: 0,
  rightNow,
  retry: { retryDays: 14, scamRecheckDays: 180 }
}
const days = (count: number): string =>
  new Date(rightNow.getTime() + count * 24 * 60 * 60 * 1000).toISOString()

describe('decideProposal', function () {
  it('applies a proven, clean, priced, on-par mapping', function () {
    const outcome = decideProposal({ ...base, proof })
    assert.equal(outcome.status, 'applied')
    assert.equal(outcome.judge, 'proof')
    assert.equal(outcome.coingeckoId, 'usd-coin')
    assert.deepEqual(outcome.reasons, [])
    assert.isTrue(outcome.guards.every(guard => guard.passed))
    assert.isUndefined(outcome.nextAttemptAfter)
  })

  it('never prices a strong scam signal or a scam verdict', function () {
    const flagged = decideProposal({
      ...base,
      proof,
      signals: [{ name: 'is_honeypot', strength: 'strong', detail: '' }]
    })
    assert.equal(flagged.status, 'suspected_scam')
    assert.deepEqual(flagged.reasons, ['is_honeypot'])
    assert.equal(flagged.nextAttemptAfter, days(180))

    const verdict = decideProposal({
      ...base,
      verdict: { ...sameAsset, decision: 'suspected_scam', rationale: 'clone' }
    })
    assert.equal(verdict.status, 'suspected_scam')
    assert.deepEqual(verdict.reasons, ['verdict_scam'])
  })

  it('proposes instead of applying when auto-apply is off', function () {
    const outcome = decideProposal({
      ...base,
      proof,
      autoApply: { ...base.autoApply, enabled: false }
    })
    assert.equal(outcome.status, 'proposed')
    assert.deepEqual(outcome.reasons, ['auto_apply_enabled'])
  })

  it('needs a deterministic proof unless agent verdicts are trusted', function () {
    const cautious = decideProposal({
      ...base,
      verdict: { ...sameAsset, confidence: 0.99 }
    })
    assert.equal(cautious.status, 'proposed')
    assert.equal(cautious.judge, 'agent')
    assert.deepEqual(cautious.reasons, ['deterministic_proof'])

    const trusting = decideProposal({
      ...base,
      verdict: { ...sameAsset, confidence: 0.99 },
      autoApply: { ...base.autoApply, trustAgentVerdicts: true }
    })
    assert.equal(trusting.status, 'applied')
  })

  it('lists every failed guard', function () {
    const outcome = decideProposal({
      ...base,
      proof: { ...proof, relationship: 'third_party_bridge', confidence: 0.5 },
      signals: [{ name: 'low_holders', strength: 'weak', detail: '' }],
      independentPrice: 0.9,
      appliesThisRun: 5,
      manualEntryExists: true
    })
    assert.equal(outcome.status, 'proposed')
    assert.deepEqual(outcome.reasons, [
      'manual_entry_absent',
      'no_weak_signals',
      'relationship_allowed',
      'price_parity',
      'confidence',
      'run_cap'
    ])
  })

  it('requires an independent price unless config waives it', function () {
    const strict = decideProposal({
      ...base,
      proof,
      independentPrice: undefined
    })
    assert.deepEqual(strict.reasons, ['independent_price', 'price_parity'])
    const relaxed = decideProposal({
      ...base,
      proof,
      independentPrice: undefined,
      autoApply: { ...base.autoApply, requireIndependentPrice: false }
    })
    assert.equal(relaxed.status, 'applied')
  })

  it('waives the soft guards when forced, never the hard ones', function () {
    const outcome = decideProposal({
      ...base,
      forced: true,
      verdict: { ...sameAsset, confidence: 0.6, relationship: 'other' },
      signals: [{ name: 'low_holders', strength: 'weak', detail: '' }],
      autoApply: { ...base.autoApply, enabled: false },
      appliesThisRun: 99
    })
    assert.equal(outcome.status, 'applied')
    const unpriced = decideProposal({
      ...base,
      forced: true,
      proof,
      destinationRate: undefined
    })
    assert.deepEqual(unpriced.reasons, ['dest_priced'])
    const manual = decideProposal({
      ...base,
      forced: true,
      proof,
      manualEntryExists: true
    })
    assert.deepEqual(manual.reasons, ['manual_entry_absent'])
  })

  it('asks for a manual mapping when no Edge asset prices the coin', function () {
    const outcome = decideProposal({ ...base, proof, destination: undefined })
    assert.equal(outcome.status, 'needs_manual_mapping')
    assert.equal(outcome.coingeckoId, 'usd-coin')
    assert.deepEqual(outcome.reasons, ['no Edge asset is priced as usd-coin'])
  })

  it('stores non-matching verdicts with a recheck window', function () {
    const notFound = decideProposal({
      ...base,
      verdict: { ...sameAsset, decision: 'not_found', coingeckoId: null }
    })
    assert.equal(notFound.status, 'not_found')
    assert.equal(notFound.nextAttemptAfter, days(14))
    const again = decideProposal({
      ...base,
      attempts: 1,
      verdict: { ...sameAsset, decision: 'unsure' }
    })
    assert.equal(again.nextAttemptAfter, days(28))
    const distinct = decideProposal({
      ...base,
      verdict: { ...sameAsset, decision: 'distinct_asset' }
    })
    assert.equal(distinct.status, 'distinct_asset')
    assert.equal(distinct.nextAttemptAfter, days(90))
    const noId = decideProposal({
      ...base,
      verdict: { ...sameAsset, coingeckoId: null }
    })
    assert.equal(noId.status, 'unsure')
  })

  it('waits for the agent when nothing has decided yet', function () {
    const outcome = decideProposal(base)
    assert.equal(outcome.status, 'awaiting_agent')
    assert.isUndefined(outcome.nextAttemptAfter)
  })
})

describe('nextAttemptAfter', function () {
  it('doubles the retry window and caps it at 90 days', function () {
    const retry = { retryDays: 14, scamRecheckDays: 180 }
    assert.equal(nextAttemptAfter('error', 1, rightNow, retry), days(14))
    assert.equal(nextAttemptAfter('error', 3, rightNow, retry), days(56))
    assert.equal(nextAttemptAfter('error', 4, rightNow, retry), days(90))
    assert.equal(nextAttemptAfter('error', 9, rightNow, retry), days(90))
    assert.isUndefined(nextAttemptAfter('applied', 1, rightNow, retry))
  })
})
