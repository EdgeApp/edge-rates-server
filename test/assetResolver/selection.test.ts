import { assert } from 'chai'
import { describe, it } from 'mocha'

import type { ReportedAsset } from '../../src/v3/providers/assetResolver/report'
import {
  agentSummary,
  resolverReportSections
} from '../../src/v3/providers/assetResolver/report'
import {
  findSuperseded,
  selectResearchCandidates
} from '../../src/v3/providers/assetResolver/selection'
import {
  asProposal,
  type Proposal,
  type ProposalMap
} from '../../src/v3/providers/assetResolver/types'

const rightNow = new Date('2026-09-25T16:00:00.000Z')
const proposal = (
  status: Proposal['status'],
  nextAttemptAfter?: string
): Proposal =>
  asProposal({
    asset: { pluginId: 'polygon', tokenId: 'x' },
    assetClass: 'unmapped-token',
    status,
    attempts: 1,
    firstSeen: '2026-09-01T00:00:00.000Z',
    lastAttempt: '2026-09-01T00:00:00.000Z',
    nextAttemptAfter
  })
const entries: ReportedAsset[] = [
  { key: 'polygon_a', count: 40, assetClass: 'unmapped-token' },
  { key: 'polygon_b', count: 12, assetClass: 'unmapped-token' },
  { key: 'wax', count: 9, assetClass: 'unmapped-native' },
  { key: 'polygon_c', count: 8, assetClass: 'unmapped-token' },
  { key: 'polygon_d', count: 7, assetClass: 'unmapped-token' },
  { key: 'FOOBAR', count: 100, assetClass: 'v2-unknown-code' },
  { key: 'polygon_e', count: 2, assetClass: 'unmapped-token' }
]

describe('selectResearchCandidates', function () {
  it('keeps resolvable, requested, unsettled assets up to the cap', function () {
    const proposals: ProposalMap = {
      polygon_b: proposal('proposed'),
      wax: proposal('not_found', '2026-10-01T00:00:00.000Z'),
      polygon_c: proposal('not_found', '2026-09-20T00:00:00.000Z'),
      polygon_d: proposal('awaiting_agent')
    }
    const picked = selectResearchCandidates(entries, proposals, {
      rightNow,
      minRequestCount: 5,
      maxAssetsPerRun: 2
    })
    assert.deepEqual(
      picked.map(entry => entry.key),
      ['polygon_a', 'polygon_c']
    )
    const all = selectResearchCandidates(entries, proposals, {
      rightNow,
      minRequestCount: 5,
      maxAssetsPerRun: 10
    })
    assert.deepEqual(
      all.map(entry => entry.key),
      ['polygon_a', 'polygon_c', 'polygon_d']
    )
  })
})

describe('findSuperseded', function () {
  it('retires proposals another document now covers', function () {
    const proposals: ProposalMap = {
      polygon_a: proposal('applied'),
      polygon_b: proposal('proposed'),
      polygon_c: proposal('suspected_scam'),
      polygon_d: proposal('needs_manual_mapping')
    }
    const context = {
      tokenTypes: {},
      platforms: {},
      mappedKeys: new Set(['polygon_a', 'polygon_c', 'ethereum_x']),
      crossChain: {
        polygon_d: {
          sourceChain: 'polygon',
          destChain: 'ethereum',
          currencyCode: 'X',
          tokenId: 'x'
        }
      }
    }
    assert.deepEqual(findSuperseded(proposals, context), [
      'polygon_a',
      'polygon_d'
    ])
  })
})

describe('resolverReportSections', function () {
  it('renders one section per outcome and the agent summary', function () {
    const report = {
      resolved: [
        {
          key: 'polygon_a',
          symbol: 'USDC',
          status: 'applied',
          coingeckoId: 'usd-coin',
          relationship: 'canonical_bridge',
          confidence: 0.99,
          judge: 'proof',
          destinationKey: 'ethereum_x',
          reasons: [],
          signals: []
        },
        {
          key: 'polygon_b',
          symbol: 'USDT',
          status: 'proposed',
          coingeckoId: 'tether',
          relationship: 'native_issuance',
          confidence: 0.91,
          judge: 'agent',
          destinationKey: 'ethereum_y',
          reasons: ['deterministic_proof'],
          signals: []
        },
        {
          key: 'base_c',
          symbol: 'USDC',
          status: 'suspected_scam',
          judge: 'none',
          reasons: ['impersonation'],
          signals: ['impersonation', 'is_honeypot']
        },
        {
          key: 'wax',
          status: 'needs_manual_mapping',
          coingeckoId: 'wax',
          judge: 'proof',
          reasons: [],
          signals: []
        },
        {
          key: 'polygon_d',
          status: 'not_found',
          judge: 'agent',
          reasons: ['Nothing lists it'],
          signals: []
        }
      ],
      superseded: ['polygon_z'],
      batch: { batchId: '2026-09-25-16-00-00', assetCount: 3, verdictCount: 3 }
    }
    const text = resolverReportSections(report)
      .map(section => [section.title, ...section.lines].join('\n'))
      .join('\n')
    assert.equal(
      text,
      [
        'APPLIED',
        '- polygon_a (USDC) -> ethereum_x usd-coin, canonical_bridge, 0.99 proof',
        'PROPOSED (needs review)',
        '- polygon_b (USDT) -> ethereum_y tether, native_issuance, 0.91 agent | not applied: deterministic_proof',
        'SUSPECTED SCAM (not priced)',
        '- base_c (USDC) | impersonation, is_honeypot',
        'NEEDS MANUAL MAPPING',
        '- wax | coingecko "wax" is not priced on any Edge chain; add "wax": { "id": "wax", "displayName": "wax" } to rates_settings/coingecko',
        'NOT RESOLVED (rechecked later)',
        '- polygon_d | not_found: Nothing lists it',
        'SUPERSEDED (now mapped by another document)',
        '- polygon_z'
      ].join('\n')
    )
    assert.equal(
      agentSummary(report),
      'agent batch 2026-09-25-16-00-00: 3 assets, 3 verdicts'
    )
    assert.isUndefined(agentSummary({ resolved: [], superseded: [] }))
    const failed = resolverReportSections({
      resolved: [],
      superseded: [],
      batch: { batchId: 'b', assetCount: 2 },
      agentError: 'timed out after 1800s'
    })
    assert.deepEqual(failed, [
      { title: 'AGENT ERROR', lines: ['- batch b: timed out after 1800s'] }
    ])
  })
})
