import { assert } from 'chai'
import { describe, it } from 'mocha'

import {
  type ClassifierContext,
  classifyUnresolvedAsset,
  isIgnored,
  isMappedNow,
  toCanonicalKey
} from '../../src/v3/providers/assetResolver/classify'

const context: ClassifierContext = {
  tokenTypes: {
    binance: null,
    ethereum: 'evm',
    polygon: 'evm',
    ufo: null
  },
  platforms: {
    binance: 'binancecoin',
    ethereum: 'ethereum',
    polygon: 'polygon-pos',
    ufo: null
  },
  mappedKeys: new Set([
    'bitcoin',
    'ethereum',
    'ethereum_a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  ]),
  crossChain: {
    sepolia: {
      sourceChain: 'sepolia',
      destChain: 'ethereum',
      currencyCode: 'ETH',
      tokenId: null
    },
    polygon_2791: {
      sourceChain: 'polygon',
      destChain: 'ethereum',
      currencyCode: 'USDC',
      tokenId: 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    }
  }
}

describe('toCanonicalKey', function () {
  it('follows one cross-chain hop', function () {
    assert.equal(toCanonicalKey(context.crossChain, 'sepolia'), 'ethereum')
    assert.equal(
      toCanonicalKey(context.crossChain, 'polygon_2791'),
      'ethereum_a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    )
  })

  it('leaves unmapped keys alone', function () {
    assert.equal(
      toCanonicalKey(context.crossChain, 'polygon_dead'),
      'polygon_dead'
    )
  })
})

describe('isMappedNow', function () {
  it('checks the canonical key against the provider maps', function () {
    assert.isTrue(isMappedNow(context, 'bitcoin'))
    assert.isTrue(isMappedNow(context, 'sepolia'))
    assert.isTrue(isMappedNow(context, 'polygon_2791'))
    assert.isFalse(isMappedNow(context, 'polygon_dead'))
  })
})

describe('classifyUnresolvedAsset', function () {
  const cases: Array<[string, string]> = [
    ['bitcoin', 'mapped-unpriced'],
    ['polygon_2791', 'mapped-unpriced'],
    ['FOOBAR', 'v2-unknown-code'],
    ['1INCH', 'v2-unknown-code'],
    ['$CWIF', 'v2-unknown-code'],
    ['monad', 'unknown-plugin'],
    ['monad_dead', 'unknown-plugin'],
    ['ufo', 'unmapped-native'],
    ['polygon', 'unmapped-native'],
    ['binance_dead', 'chain-tokens-unsupported'],
    ['ufo_dead', 'chain-tokens-unsupported'],
    ['polygon_dead', 'unmapped-token']
  ]
  for (const [key, expected] of cases) {
    it(`classifies ${key} as ${expected}`, function () {
      assert.equal(classifyUnresolvedAsset(context, key), expected)
    })
  }
})

describe('isIgnored', function () {
  const rightNow = new Date('2026-09-25T12:00:00.000Z')

  it('is false without an entry', function () {
    assert.isFalse(isIgnored(undefined, rightNow))
  })

  it('ignores forever without an until day', function () {
    assert.isTrue(
      isIgnored({ reason: 'dead token', until: undefined }, rightNow)
    )
    assert.isTrue(isIgnored({ reason: 'dead token', until: '' }, rightNow))
  })

  it('honors a future until day and drops a past one', function () {
    assert.isTrue(isIgnored({ reason: 'later', until: '2026-10-01' }, rightNow))
    assert.isFalse(
      isIgnored({ reason: 'later', until: '2026-09-25' }, rightNow)
    )
    assert.isFalse(
      isIgnored({ reason: 'later', until: '2026-01-01' }, rightNow)
    )
  })

  it('never silences an asset on an unparseable until day', function () {
    assert.isFalse(isIgnored({ reason: 'typo', until: 'next week' }, rightNow))
  })
})
