import { assert } from 'chai'
import { describe, it } from 'mocha'

import {
  asGoPlusToken,
  asJupiterToken,
  asRugCheckSummary
} from '../../src/v3/providers/assetResolver/evidence/types'
import {
  detectScamSignals,
  hasStrongSignal,
  type ScamConfig
} from '../../src/v3/providers/assetResolver/scam'
import { makeEvidence, topCoins } from './helpers'

const config: ScamConfig = {
  minLiquidityUsd: 10000,
  minHolders: 50,
  maxSellTax: 0.2,
  rugcheckMaxScore: 50,
  topCoinRank: 300
}

const names = (evidence = makeEvidence()): string[] =>
  detectScamSignals(evidence, topCoins, config).map(signal => signal.name)

describe('detectScamSignals', function () {
  it('flags a top-coin look-alike that no trusted source lists', function () {
    const evidence = makeEvidence({
      defiLlama: { symbol: 'USDC', price: 1, confidence: 0.99 }
    })
    const signals = detectScamSignals(evidence, topCoins, config)
    assert.deepEqual(
      signals.map(signal => [signal.name, signal.strength]),
      [['impersonation', 'strong']]
    )
    assert.include(signals[0].detail, 'usd-coin')
  })

  it('ignores look-alikes of coins outside the top ranks', function () {
    const evidence = makeEvidence({
      defiLlama: { symbol: 'OBS', price: 1, confidence: 0.99 }
    })
    assert.notInclude(names(evidence), 'impersonation')
  })

  it('trusts the issuer registry, CoinGecko listings, and bridge lists', function () {
    const base = { defiLlama: { symbol: 'USDC', price: 1, confidence: 0.99 } }
    const registry = makeEvidence({
      ...base,
      issuerRegistry: {
        coingeckoId: 'usd-coin',
        issuer: 'Circle',
        symbol: 'USDC',
        relationship: 'canonical_bridge',
        source: 'https://www.circle.com/multi-chain-usdc'
      }
    })
    const listed = makeEvidence({
      ...base,
      coingecko: {
        addressIndex: [
          {
            id: 'bridged-usdc',
            symbol: 'usdc.e',
            name: 'Bridged USDC',
            platformId: 'polygon-pos',
            pluginId: 'polygon'
          }
        ],
        search: [],
        candidates: []
      }
    })
    const bridged = makeEvidence({
      ...base,
      tokenLists: [
        {
          list: 'uniswap',
          name: 'USD Coin (PoS)',
          symbol: 'USDC.e',
          bridgeInfo: [{ chainId: 1, tokenAddress: '0xa0b8' }]
        }
      ]
    })
    const elsewhere = makeEvidence({
      ...base,
      coingecko: {
        addressIndex: [
          {
            id: 'fake-usdc',
            symbol: 'usdc',
            name: 'USDC',
            platformId: 'arbitrum-one'
          }
        ],
        search: [],
        candidates: []
      }
    })
    assert.notInclude(names(registry), 'impersonation')
    assert.notInclude(names(listed), 'impersonation')
    assert.notInclude(names(bridged), 'impersonation')
    assert.include(names(elsewhere), 'impersonation')
  })

  it('reads GoPlus security flags, taxes, liquidity, holders, and source', function () {
    const evidence = makeEvidence({
      defiLlama: { symbol: 'OBS', price: 1, confidence: 0.99 },
      goplus: asGoPlusToken({
        is_honeypot: '1',
        sell_tax: '0.35',
        is_in_dex: '1',
        dex: [{ liquidity: '1200.5' }, { liquidity: 'bad' }],
        holder_count: '12',
        is_open_source: '0'
      })
    })
    const signals = detectScamSignals(evidence, topCoins, config)
    assert.deepEqual(
      signals.map(signal => [signal.name, signal.strength]),
      [
        ['is_honeypot', 'strong'],
        ['sell_tax', 'strong'],
        ['no_liquidity', 'weak'],
        ['low_holders', 'weak'],
        ['unverified_contract', 'weak']
      ]
    )
  })

  it('treats fake_token as strong and healthy GoPlus numbers as clean', function () {
    const fake = makeEvidence({
      defiLlama: { symbol: 'OBS', price: 1, confidence: 0.99 },
      goplus: asGoPlusToken({
        fake_token: { value: 1, true_token_address: '0xreal' },
        dex: []
      })
    })
    assert.include(names(fake), 'fake_token')
    const healthy = makeEvidence({
      defiLlama: { symbol: 'OBS', price: 1, confidence: 0.99 },
      goplus: asGoPlusToken({
        is_honeypot: '0',
        is_open_source: '1',
        is_in_dex: '1',
        dex: [{ liquidity: '2500000' }],
        holder_count: '120000',
        sell_tax: '0'
      })
    })
    assert.deepEqual(names(healthy), [])
  })

  it('reads RugCheck and Jupiter for Solana mints', function () {
    const evidence = makeEvidence({
      chain: { pluginId: 'solana', tokenType: 'simple', platformId: 'solana' },
      address: 'Mint',
      jupiter: asJupiterToken({
        id: 'Mint',
        name: 'Obscure',
        symbol: 'OBS',
        tags: [],
        liquidity: 500,
        holderCount: 3
      }),
      rugcheck: asRugCheckSummary({
        score_normalised: 80,
        risks: [
          { name: 'Mint Authority still enabled', level: 'danger' },
          { name: 'Low LP', level: 'warn' }
        ]
      })
    })
    assert.deepEqual(names(evidence), [
      'rugcheck_danger',
      'rugcheck_score',
      'unverified_solana',
      'no_liquidity',
      'low_holders'
    ])
    const verified = makeEvidence({
      chain: { pluginId: 'solana', tokenType: 'simple', platformId: 'solana' },
      address: 'Mint',
      jupiter: asJupiterToken({
        id: 'Mint',
        name: 'USD Coin',
        symbol: 'USDC',
        tags: ['verified'],
        isVerified: true
      }),
      issuerRegistry: {
        coingeckoId: 'usd-coin',
        issuer: 'Circle',
        symbol: 'USDC',
        relationship: 'native_issuance',
        source: 'x'
      }
    })
    assert.deepEqual(names(verified), [])
  })

  it('notes low price confidence and a missing footprint', function () {
    assert.deepEqual(names(makeEvidence()), ['no_footprint'])
    assert.deepEqual(
      names(
        makeEvidence({
          defiLlama: { symbol: 'OBS', price: 1, confidence: 0.5 }
        })
      ),
      ['low_price_confidence']
    )
    assert.deepEqual(names(makeEvidence({ address: undefined })), [])
  })

  it('knows which signals are strong', function () {
    assert.isTrue(
      hasStrongSignal([{ name: 'is_honeypot', strength: 'strong', detail: '' }])
    )
    assert.isFalse(
      hasStrongSignal([{ name: 'low_holders', strength: 'weak', detail: '' }])
    )
    assert.isFalse(hasStrongSignal([]))
  })
})
