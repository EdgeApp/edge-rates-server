import { assert } from 'chai'
import { describe, it } from 'mocha'

import type { FetchJson } from '../../src/v3/providers/assetResolver/evidence/types'
import {
  agentJudge,
  makeJevJudge,
  proofJudge,
  selectJudge
} from '../../src/v3/providers/assetResolver/judge'
import {
  type JudgeInput,
  renderJudgeState
} from '../../src/v3/providers/assetResolver/judgeState'
import { makeEvidence } from './helpers'

const input: JudgeInput = {
  evidence: makeEvidence({
    defiLlama: { symbol: 'USDC', price: 0.9996, confidence: 0.99 },
    tokenLists: [
      {
        list: 'uniswap',
        name: 'USD Coin (PoS)',
        symbol: 'USDC.e',
        bridgeInfo: [{ chainId: 1, tokenAddress: '0xa0b8' }]
      }
    ]
  }),
  signals: [{ name: 'low_holders', strength: 'weak', detail: '' }],
  verdict: {
    key: 'polygon_2791bca1f2de4661ed88a30c99a7a9449aa84174',
    decision: 'same_asset',
    coingeckoId: 'usd-coin',
    relationship: 'canonical_bridge',
    confidence: 0.93,
    issuer: 'Circle',
    rationale: 'Bridged USDC',
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
  },
  candidate: {
    id: 'usd-coin',
    symbol: 'usdc',
    name: 'USDC',
    marketCapRank: 6,
    platforms: { ethereum: '0xa0b8' },
    homepage: ['https://www.circle.com/en/usdc'],
    categories: ['Stablecoins'],
    priceUsd: 0.9998,
    destination: {
      key: 'ethereum_a0b8',
      asset: { pluginId: 'ethereum', tokenId: 'a0b8' },
      usdRate: 0.9998
    },
    priceDelta: 0.0002
  }
}

describe('renderJudgeState', function () {
  it('renders the evidence, the claim, and the verdict deterministically', function () {
    const text = renderJudgeState(input)
    assert.equal(text, renderJudgeState(input))
    assert.include(
      text,
      'Asset: polygon_2791bca1f2de4661ed88a30c99a7a9449aa84174 on polygon'
    )
    assert.include(
      text,
      'DefiLlama: symbol USDC, price 0.9996, confidence 0.99'
    )
    assert.include(
      text,
      'Token list uniswap: USDC.e (USD Coin (PoS)) bridged from 1:0xa0b8'
    )
    assert.include(text, 'Scam signals: low_holders (weak)')
    assert.include(
      text,
      'Claimed coin: usd-coin (usdc, USDC), rank 6, homepage https://www.circle.com/en/usdc'
    )
    assert.include(
      text,
      'Edge destination: ethereum_a0b8 at 0.9998 USD, price delta 0.0002'
    )
    assert.include(
      text,
      'Agent verdict: same_asset as usd-coin (canonical_bridge), confidence 0.93'
    )
    assert.include(text, 'Evidence (same, primary): lists it https://x')
  })

  it('clips long text', function () {
    const long = renderJudgeState({
      ...input,
      verdict: { ...input.verdict!, rationale: 'x'.repeat(1000) }
    })
    assert.include(long, `Rationale: ${'x'.repeat(400)}...`)
  })
})

describe('judges', function () {
  it('reads proof and agent confidences', async function () {
    assert.isUndefined(await proofJudge.judge(input))
    const proof = await proofJudge.judge({
      ...input,
      proof: {
        kind: 'issuer_registry',
        coingeckoId: 'usd-coin',
        relationship: 'canonical_bridge',
        confidence: 0.99,
        detail: ''
      }
    })
    assert.deepEqual(proof, {
      kind: 'proof',
      model: 'issuer_registry',
      probability: 0.99
    })
    assert.deepEqual(await agentJudge.judge(input), {
      kind: 'agent',
      model: 'agent',
      probability: 0.93
    })
    assert.isUndefined(await agentJudge.judge({ ...input, verdict: undefined }))
  })

  it('asks Jev one noul question and retries a server error', async function () {
    const requests: Array<{ url: string; body: unknown }> = []
    let failures = 1
    const fetchJson: FetchJson = async (url, init) => {
      const raw = typeof init?.body === 'string' ? init.body : '{}'
      requests.push({ url, body: JSON.parse(raw) })
      if (failures > 0) {
        failures--
        return { status: 503, body: 'overloaded' }
      }
      return {
        status: 200,
        body: {
          model: 'jev-1.13.0',
          answers: { sameAsset: { type: 'noul', noul: 0.91 } },
          usage: { input_tokens: 400, output_tokens: 1 }
        }
      }
    }
    const judge = makeJevJudge({ fetchJson, apiKey: 'k', model: 'jev-latest' })
    const verdict = await judge.judge(input)
    assert.deepEqual(verdict, {
      kind: 'jev',
      model: 'jev-1.13.0',
      probability: 0.91
    })
    assert.equal(requests.length, 2)
    assert.equal(requests[0].url, 'https://api.typesafe.ai/v1/systemone')
    const body = requests[1].body as {
      model: string
      state: string
      questions: { sameAsset: { type: string } }
    }
    assert.equal(body.model, 'jev-latest')
    assert.equal(body.questions.sameAsset.type, 'noul')
    assert.include(body.state, 'Claimed coin: usd-coin')
    assert.isUndefined(await judge.judge({ ...input, verdict: undefined }))
  })

  it('selects judges and refuses Jev without a key', function () {
    const opts = {
      fetchJson: async () => ({ status: 200, body: {} }),
      typesafeApiKey: '',
      jevModel: 'jev-latest'
    }
    assert.equal(selectJudge('agent', opts).kind, 'agent')
    assert.equal(selectJudge('proof', opts).kind, 'proof')
    assert.throws(() => selectJudge('jev', opts), /TYPESAFE_API_KEY/)
    assert.equal(
      selectJudge('jev', { ...opts, typesafeApiKey: 'k' }).kind,
      'jev'
    )
  })
})
