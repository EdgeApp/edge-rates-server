import { assert } from 'chai'
import { describe, it } from 'mocha'

import type { ResolverDocs } from '../../src/v3/providers/assetResolver/docs'
import { agentJudge } from '../../src/v3/providers/assetResolver/judge'
import {
  decide,
  type ResolveDeps,
  resolveDeterministic,
  toCrossChainEntry,
  toProposal
} from '../../src/v3/providers/assetResolver/resolveAsset'
import type { Verdict } from '../../src/v3/providers/assetResolver/types'
import { makeEvidence, topCoins } from './helpers'

const rightNow = new Date('2026-09-25T16:00:00.000Z')
const usdCoin = {
  id: 'usd-coin',
  symbol: 'usdc',
  name: 'USDC',
  marketCapRank: 6,
  platforms: { ethereum: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
  homepage: ['https://www.circle.com/en/usdc'],
  categories: ['Stablecoins'],
  priceUsd: 0.9998
}
const docs: ResolverDocs = {
  context: {
    tokenTypes: { polygon: 'evm', ethereum: 'evm' },
    platforms: { polygon: 'polygon-pos', ethereum: 'ethereum' },
    mappedKeys: new Set([
      'ethereum_a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'ethereum'
    ]),
    crossChain: {}
  },
  coingeckoMap: {
    ethereum_a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48: {
      id: 'usd-coin',
      displayName: 'USDC'
    },
    ethereum: { id: 'ethereum', displayName: 'Ethereum' }
  },
  manualCoingecko: {},
  manualCrossChain: {},
  automatedCrossChain: {},
  aiCrossChain: {},
  platformPriority: { ethereum: 20 },
  proposals: {},
  ignore: {}
}
const makeDeps = (
  evidenceOverrides: Parameters<typeof makeEvidence>[0],
  overrides: Partial<ResolveDeps> = {}
): ResolveDeps => ({
  docs,
  gather: async () => makeEvidence(evidenceOverrides),
  topCoins,
  getUsdRate: async asset =>
    asset.pluginId === 'ethereum' ? 0.9998 : undefined,
  judge: agentJudge,
  config: {
    scam: {
      minLiquidityUsd: 10000,
      minHolders: 50,
      maxSellTax: 0.2,
      rugcheckMaxScore: 50,
      topCoinRank: 300
    },
    autoApply: {
      enabled: true,
      minConfidence: 0.95,
      priceParityTolerance: 0.03,
      requireIndependentPrice: true,
      relationships: ['native_issuance', 'canonical_bridge'],
      maxPerRun: 5,
      trustAgentVerdicts: false
    },
    retry: { retryDays: 14, scamRecheckDays: 180 }
  },
  rightNow,
  ...overrides
})
const asset = {
  pluginId: 'polygon',
  tokenId: '2791bca1f2de4661ed88a30c99a7a9449aa84174'
}
const proven = {
  issuerRegistry: {
    coingeckoId: 'usd-coin',
    issuer: 'Circle',
    symbol: 'USDC',
    relationship: 'canonical_bridge' as const,
    source: 'x'
  },
  defiLlama: { symbol: 'USDC', price: 0.9996, confidence: 0.99 },
  coingecko: { addressIndex: [], search: [], candidates: [usdCoin] }
}

describe('resolveDeterministic', function () {
  it('applies a proven bridged stablecoin and writes a cross-chain entry', async function () {
    const resolution = await resolveDeterministic(
      asset,
      'unmapped-token',
      makeDeps(proven),
      { appliesThisRun: 0, requestCount: 12 }
    )
    assert.equal(resolution.outcome.status, 'applied')
    assert.equal(resolution.outcome.judge, 'proof')
    assert.equal(resolution.proof?.kind, 'issuer_registry')
    assert.equal(
      resolution.destination?.key,
      'ethereum_a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    )
    assert.equal(resolution.destinationRate, 0.9998)
    assert.deepEqual(resolution.candidates[0].destination, {
      key: 'ethereum_a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      asset: {
        pluginId: 'ethereum',
        tokenId: 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
      },
      usdRate: 0.9998
    })
    assert.closeTo(resolution.candidates[0].priceDelta ?? 1, 0.0002, 0.0001)
    assert.deepEqual(toCrossChainEntry(resolution), {
      sourceChain: 'polygon',
      destChain: 'ethereum',
      currencyCode: 'USDC',
      tokenId: 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    })
    const proposal = toProposal(resolution, undefined, rightNow, {
      appliedEntry: toCrossChainEntry(resolution)
    })
    assert.equal(proposal.status, 'applied')
    assert.equal(proposal.attempts, 1)
    assert.equal(proposal.firstSeen, '2026-09-25T16:00:00.000Z')
    assert.equal(proposal.appliedAt, '2026-09-25T16:00:00.000Z')
    assert.equal(proposal.requestCount, 12)
  })

  it('falls back to CoinGecko prices when the server has no rate for a destination', async function () {
    const resolution = await resolveDeterministic(
      asset,
      'unmapped-token',
      makeDeps(proven, { getUsdRate: async () => undefined }),
      { appliesThisRun: 0, requestCount: 1 }
    )
    assert.equal(resolution.destinationRate, 0.9998)
  })

  it('waits for the agent without a proof, then gates the verdict', async function () {
    // An official list vouches for the address, but bridges it from a token Edge does not price:
    const deps = makeDeps({
      defiLlama: { symbol: 'USDC', price: 0.9996, confidence: 0.99 },
      tokenLists: [
        {
          list: 'uniswap',
          name: 'USD Coin',
          symbol: 'USDC',
          bridgeInfo: [{ chainId: 1, tokenAddress: '0xdead' }]
        }
      ],
      coingecko: { addressIndex: [], search: [], candidates: [usdCoin] }
    })
    const pending = await resolveDeterministic(asset, 'unmapped-token', deps, {
      appliesThisRun: 0,
      requestCount: 1
    })
    assert.equal(pending.outcome.status, 'awaiting_agent')
    assert.isUndefined(pending.proof)

    const verdict: Verdict = {
      key: pending.key,
      decision: 'same_asset',
      coingeckoId: 'usd-coin',
      relationship: 'canonical_bridge',
      confidence: 0.97,
      issuer: 'Circle',
      rationale: 'docs',
      evidence: [],
      scamIndicators: []
    }
    const proposed = await decide(pending, verdict, deps, {
      appliesThisRun: 0,
      requestCount: 1
    })
    assert.equal(proposed.outcome.status, 'proposed')
    assert.deepEqual(proposed.outcome.reasons, ['deterministic_proof'])
    assert.deepEqual(proposed.judged, {
      kind: 'agent',
      model: 'agent',
      probability: 0.97
    })
    assert.equal(
      proposed.destination?.key,
      'ethereum_a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    )

    const trusting = makeDeps(
      {},
      {
        ...deps,
        config: {
          ...deps.config,
          autoApply: { ...deps.config.autoApply, trustAgentVerdicts: true }
        }
      }
    )
    const applied = await decide(pending, verdict, trusting, {
      appliesThisRun: 0,
      requestCount: 1
    })
    assert.equal(applied.outcome.status, 'applied')

    const shadowed = makeDeps(
      {},
      {
        ...deps,
        judge: {
          kind: 'jev',
          judge: async () => ({ kind: 'jev', model: 'jev-1', probability: 0.5 })
        }
      }
    )
    const judged = await decide(pending, verdict, shadowed, {
      appliesThisRun: 0,
      requestCount: 1
    })
    assert.equal(judged.outcome.confidence, 0.5)
    assert.include(judged.outcome.reasons, 'confidence')
  })

  it('refuses to price a look-alike', async function () {
    const resolution = await resolveDeterministic(
      asset,
      'unmapped-token',
      makeDeps({
        defiLlama: { symbol: 'USDC', price: 1, confidence: 0.99 },
        coingecko: { addressIndex: [], search: [], candidates: [usdCoin] }
      }),
      { appliesThisRun: 0, requestCount: 1 }
    )
    assert.equal(resolution.outcome.status, 'suspected_scam')
    assert.deepEqual(resolution.outcome.reasons, ['impersonation'])
  })
})
