import { assert } from 'chai'
import { describe, it } from 'mocha'

import {
  buildMappedAssets,
  deriveDestination
} from '../../src/v3/providers/assetResolver/destination'
import { findProvenance } from '../../src/v3/providers/assetResolver/provenance'
import { makeEvidence } from './helpers'

const mappedAssets = new Map([
  ['ethereum_a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 'usd-coin'],
  ['ethereum', 'ethereum']
])

describe('findProvenance', function () {
  it('prefers the issuer registry', function () {
    const proof = findProvenance(
      makeEvidence({
        issuerRegistry: {
          coingeckoId: 'usd-coin',
          issuer: 'Circle',
          symbol: 'USDC',
          relationship: 'canonical_bridge',
          source: 'x'
        },
        coingecko: {
          contract: {
            id: 'other',
            symbol: 'o',
            name: 'o',
            platforms: {},
            homepage: [],
            categories: []
          },
          addressIndex: [],
          search: [],
          candidates: []
        }
      }),
      mappedAssets
    )
    assert.equal(proof?.kind, 'issuer_registry')
    assert.equal(proof?.coingeckoId, 'usd-coin')
    assert.equal(proof?.relationship, 'canonical_bridge')
    assert.equal(proof?.confidence, 0.99)
  })

  it('proves a canonical bridge from an official list whose origin Edge prices', function () {
    const proof = findProvenance(
      makeEvidence({
        tokenLists: [
          {
            list: 'uniswap',
            name: 'USD Coin (PoS)',
            symbol: 'USDC.e',
            bridgeInfo: [
              {
                chainId: 1,
                tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
              }
            ]
          }
        ]
      }),
      mappedAssets
    )
    assert.equal(proof?.kind, 'canonical_bridge_list')
    assert.equal(proof?.coingeckoId, 'usd-coin')
    assert.equal(proof?.relationship, 'canonical_bridge')
  })

  it('falls through when the bridge origin is not priced', function () {
    const proof = findProvenance(
      makeEvidence({
        tokenLists: [
          {
            list: 'uniswap',
            name: 'x',
            symbol: 'X',
            bridgeInfo: [{ chainId: 1, tokenAddress: '0xdead' }]
          }
        ],
        coingecko: {
          addressIndex: [
            {
              id: 'some-coin',
              symbol: 's',
              name: 's',
              platformId: 'polygon-pos',
              pluginId: 'polygon'
            }
          ],
          search: [],
          candidates: []
        }
      }),
      mappedAssets
    )
    assert.equal(proof?.kind, 'coingecko_address')
    assert.equal(proof?.coingeckoId, 'some-coin')
    assert.equal(proof?.relationship, 'native_issuance')
  })

  it('uses the chain registry with the trace deciding the relationship', function () {
    const bridged = findProvenance(
      makeEvidence({
        chainRegistry: {
          base: 'ibc/X',
          coingeckoId: 'usd-coin',
          traces: [{ type: 'ibc', chainName: 'noble', baseDenom: 'uusdc' }]
        }
      }),
      mappedAssets
    )
    assert.equal(bridged?.kind, 'chain_registry')
    assert.equal(bridged?.relationship, 'canonical_bridge')
    const native = findProvenance(
      makeEvidence({
        chainRegistry: { base: 'uosmo', coingeckoId: 'osmosis', traces: [] }
      }),
      mappedAssets
    )
    assert.equal(native?.relationship, 'native_issuance')
    assert.equal(native?.confidence, 0.95)
  })

  it('finds nothing without a trusted source', function () {
    assert.isUndefined(findProvenance(makeEvidence(), mappedAssets))
    assert.isUndefined(
      findProvenance(
        makeEvidence({
          coingecko: {
            addressIndex: [
              { id: 'x', symbol: 'x', name: 'x', platformId: 'arbitrum-one' }
            ],
            search: [],
            candidates: []
          }
        }),
        mappedAssets
      )
    )
  })
})

describe('deriveDestination', function () {
  const context = {
    coingeckoMap: {
      ethereum_a0b8: { id: 'usd-coin', displayName: 'USDC' },
      base_8335: { id: 'usd-coin', displayName: 'USDC' },
      arbitrum_af88: { id: 'usd-coin', displayName: 'USDC' },
      solana_epjf: { id: 'usd-coin', displayName: 'USDC' },
      bitcoin: { id: 'bitcoin', displayName: 'Bitcoin' }
    },
    crossChainSources: new Set(['base_8335']),
    platformPriority: { ethereum: 20, arbitrum: 30, bitcoin: 10 }
  }

  it('picks the highest-priority chain that is not a cross-chain source', function () {
    const destination = deriveDestination('usd-coin', context)
    assert.equal(destination?.key, 'ethereum_a0b8')
    assert.deepEqual(destination?.asset, {
      pluginId: 'ethereum',
      tokenId: 'a0b8'
    })
    assert.equal(destination?.priority, 20)
  })

  it('orders unknown-priority chains last and ties by key', function () {
    const destination = deriveDestination('usd-coin', {
      ...context,
      platformPriority: {}
    })
    assert.equal(destination?.key, 'arbitrum_af88')
  })

  it('returns nothing when no Edge asset maps the id', function () {
    assert.isUndefined(deriveDestination('tether', context))
    const native = deriveDestination('bitcoin', context)
    assert.deepEqual(native?.asset, { pluginId: 'bitcoin', tokenId: null })
  })

  it('builds the mapped-asset index', function () {
    assert.deepEqual(
      Array.from(buildMappedAssets(context.coingeckoMap)).slice(0, 2),
      [
        ['ethereum_a0b8', 'usd-coin'],
        ['base_8335', 'usd-coin']
      ]
    )
  })
})
