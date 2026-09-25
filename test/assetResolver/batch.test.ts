import { assert } from 'chai'
import { describe, it } from 'mocha'

import {
  buildBatch,
  indexVerdicts,
  instructionsVersion,
  makeBatchId,
  parseVerdictsFile
} from '../../src/v3/providers/assetResolver/batch'

const verdict = {
  key: 'polygon_2791',
  decision: 'same_asset',
  coingeckoId: 'usd-coin',
  relationship: 'canonical_bridge',
  confidence: 0.93,
  issuer: 'Circle',
  rationale: 'Bridged USDC per the Polygon docs',
  evidence: [
    {
      source: 'Polygon docs',
      url: 'https://x',
      claim: 'lists it',
      supports: 'same',
      primary: true
    }
  ],
  scamIndicators: []
}
const file = {
  batchId: '2026-09-25-16-05-00',
  instructionsVersion,
  agent: { name: 'cursor-agent' },
  verdicts: [verdict]
}
const batch = {
  batchId: '2026-09-25-16-05-00',
  instructionsVersion,
  keys: ['polygon_2791', 'wax']
}

describe('parseVerdictsFile', function () {
  it('accepts a well-formed answer to the batch', function () {
    const parsed = parseVerdictsFile(JSON.stringify(file), batch)
    assert.equal(parsed.verdicts[0].coingeckoId, 'usd-coin')
    assert.isTrue(parsed.verdicts[0].evidence[0].primary)
    assert.equal(
      indexVerdicts(parsed).get('polygon_2791')?.decision,
      'same_asset'
    )
  })

  it('clamps confidence into the unit interval', function () {
    const parsed = parseVerdictsFile(
      JSON.stringify({ ...file, verdicts: [{ ...verdict, confidence: 1.4 }] }),
      batch
    )
    assert.equal(parsed.verdicts[0].confidence, 1)
  })

  it('rejects the wrong batch, version, strangers, repeats, and bad values', function () {
    assert.throws(
      () =>
        parseVerdictsFile(JSON.stringify({ ...file, batchId: 'other' }), batch),
      /not 2026-09-25-16-05-00/
    )
    assert.throws(
      () =>
        parseVerdictsFile(
          JSON.stringify({ ...file, instructionsVersion: 99 }),
          batch
        ),
      /instructions version 99/
    )
    assert.throws(
      () =>
        parseVerdictsFile(
          JSON.stringify({ ...file, verdicts: [{ ...verdict, key: 'ufo' }] }),
          batch
        ),
      /not in the batch/
    )
    assert.throws(
      () =>
        parseVerdictsFile(
          JSON.stringify({ ...file, verdicts: [verdict, verdict] }),
          batch
        ),
      /Duplicate/
    )
    assert.throws(() =>
      parseVerdictsFile(
        JSON.stringify({
          ...file,
          verdicts: [{ ...verdict, decision: 'maybe' }]
        }),
        batch
      )
    )
    assert.throws(() =>
      parseVerdictsFile(
        JSON.stringify({
          ...file,
          verdicts: [{ ...verdict, confidence: 'high' }]
        }),
        batch
      )
    )
    assert.throws(() => parseVerdictsFile('not json', batch))
  })
})

describe('buildBatch', function () {
  it('stamps a filesystem-safe id and the instructions version', function () {
    const rightNow = new Date('2026-09-25T16:05:00.000Z')
    assert.equal(makeBatchId(rightNow), '2026-09-25-16-05-00')
    const built = buildBatch([], rightNow)
    assert.equal(built.instructionsVersion, instructionsVersion)
    assert.equal(built.createdAt, '2026-09-25T16:05:00.000Z')
  })
})
