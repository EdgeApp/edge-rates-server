import { assert } from 'chai'
import { describe, it } from 'mocha'

import {
  buildCalibrationSamples,
  type CalibrationSample,
  scoreCalibration
} from '../../src/v3/providers/assetResolver/calibrate'
import type { Resolution } from '../../src/v3/providers/assetResolver/resolveAsset'
import type { ProposalStatus } from '../../src/v3/providers/assetResolver/types'
import coingeckoListFixture from './fixtures/coingeckoList.json'
import { makeEvidence, topCoins } from './helpers'

const resolution = (
  key: string,
  coingeckoId: string | undefined,
  confidence: number | undefined,
  status: ProposalStatus = 'applied'
): Resolution => ({
  key,
  asset: { pluginId: key.split('_')[0], tokenId: key.split('_')[1] ?? null },
  assetClass: 'unmapped-token',
  requestCount: 0,
  evidence: makeEvidence({ key }),
  signals:
    status === 'suspected_scam'
      ? [{ name: 'impersonation', strength: 'strong', detail: '' }]
      : [],
  candidates: [],
  outcome: {
    status,
    coingeckoId,
    confidence,
    judge: 'proof',
    guards: [],
    reasons: []
  }
})

describe('scoreCalibration', function () {
  it('measures precision per threshold, false sames, and calibration buckets', function () {
    const samples: CalibrationSample[] = [
      {
        key: 'polygon_a',
        asset: { pluginId: 'polygon', tokenId: 'a' },
        coingeckoId: 'usd-coin',
        expectedId: 'usd-coin',
        positive: true,
        note: ''
      },
      {
        key: 'polygon_b',
        asset: { pluginId: 'polygon', tokenId: 'b' },
        coingeckoId: 'tether',
        expectedId: 'tether',
        positive: true,
        note: ''
      },
      {
        key: 'polygon_c',
        asset: { pluginId: 'polygon', tokenId: 'c' },
        coingeckoId: 'fake-usdc',
        expectedId: 'usd-coin',
        positive: false,
        note: ''
      },
      {
        key: 'polygon_d',
        asset: { pluginId: 'polygon', tokenId: 'd' },
        coingeckoId: 'fake-usdt',
        expectedId: 'tether',
        positive: false,
        note: ''
      },
      {
        key: 'polygon_e',
        asset: { pluginId: 'polygon', tokenId: 'e' },
        coingeckoId: 'dai',
        expectedId: 'dai',
        positive: true,
        note: ''
      }
    ]
    const resolutions = new Map<string, Resolution>([
      ['polygon_a', resolution('polygon_a', 'usd-coin', 0.99)],
      ['polygon_b', resolution('polygon_b', 'tether', 0.97)],
      ['polygon_c', resolution('polygon_c', 'usd-coin', 0.6, 'proposed')],
      [
        'polygon_d',
        resolution('polygon_d', undefined, undefined, 'suspected_scam')
      ],
      [
        'polygon_e',
        resolution('polygon_e', undefined, undefined, 'awaiting_agent')
      ]
    ])
    const { rows, report } = scoreCalibration(samples, resolutions)
    assert.equal(rows.length, 5)
    assert.equal(report.positives, 3)
    assert.equal(report.negatives, 2)
    assert.equal(report.claimedCorrect, 2)
    assert.equal(report.claimedWrong, 1)
    assert.equal(report.falseSame, 1)
    assert.equal(report.unresolved, 2)
    assert.equal(report.scamFlaggedPositives, 0)
    assert.closeTo(
      report.brierScore ?? 1,
      (0.01 ** 2 + 0.03 ** 2 + 0.6 ** 2) / 3,
      1e-9
    )
    const at95 = report.thresholds.find(row => row.threshold === 0.95)
    assert.equal(at95?.precision, 1)
    assert.closeTo(at95?.recall ?? 0, 2 / 3, 1e-9)
    const at50 = report.thresholds.find(row => row.threshold === 0.5)
    assert.closeTo(at50?.precision ?? 0, 2 / 3, 1e-9)
    assert.isUndefined(report.recommendedThreshold)
    const bucket = report.buckets.find(row => row.floor === 0.95)
    assert.deepEqual(bucket, { floor: 0.95, count: 2, correct: 2 })
  })
})

describe('buildCalibrationSamples', function () {
  it('draws positives from secondary deployments and negatives from symbol clones', async function () {
    const client = {
      get: async () => ({ status: 200, body: coingeckoListFixture })
    }
    const docs = {
      tokenTypes: { ethereum: 'evm', polygon: 'evm', arbitrum: 'evm' },
      platforms: {
        ethereum: 'ethereum',
        polygon: 'polygon-pos',
        arbitrum: 'arbitrum-one'
      }
    }
    const samples = await buildCalibrationSamples(client, docs, topCoins, {
      pairs: 10,
      seed: 7
    })
    const positive = samples.find(sample => sample.positive)
    assert.equal(positive?.coingeckoId, 'usd-coin')
    assert.equal(positive?.asset.pluginId, 'polygon')
    const negative = samples.find(sample => !sample.positive)
    assert.equal(negative?.coingeckoId, 'fake-usdc')
    assert.equal(negative?.expectedId, 'usd-coin')
    assert.equal(negative?.asset.pluginId, 'arbitrum')
    const again = await buildCalibrationSamples(client, docs, topCoins, {
      pairs: 10,
      seed: 7
    })
    assert.deepEqual(
      again.map(sample => sample.key),
      samples.map(sample => sample.key)
    )
  })
})
