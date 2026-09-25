import { assert } from 'chai'
import { describe, it } from 'mocha'

import { fetchChainRegistryAsset } from '../../src/v3/providers/assetResolver/evidence/chainRegistry'
import {
  fetchAddressIndex,
  makeCoingeckoClient
} from '../../src/v3/providers/assetResolver/evidence/coingecko'
import { gatherEvidence } from '../../src/v3/providers/assetResolver/evidence/gather'
import {
  fetchGoPlusToken,
  toGoPlusChainId
} from '../../src/v3/providers/assetResolver/evidence/goplus'
import { issuerRegistry } from '../../src/v3/providers/assetResolver/evidence/issuerRegistry'
import { fetchJupiterToken } from '../../src/v3/providers/assetResolver/evidence/jupiter'
import { fetchRugCheckSummary } from '../../src/v3/providers/assetResolver/evidence/rugcheck'
import { makeTokenListLookup } from '../../src/v3/providers/assetResolver/evidence/tokenLists'
import type { FetchJson } from '../../src/v3/providers/assetResolver/evidence/types'
import chainRegistryFixture from './fixtures/chainRegistry.json'
import coingeckoCoinFixture from './fixtures/coingeckoCoin.json'
import coingeckoListFixture from './fixtures/coingeckoList.json'
import coingeckoSearchFixture from './fixtures/coingeckoSearch.json'
import defillamaFixture from './fixtures/defillama.json'
import goplusFixture from './fixtures/goplus.json'
import jupiterFixture from './fixtures/jupiter.json'
import rugcheckFixture from './fixtures/rugcheck.json'
import superchainFixture from './fixtures/superchainTokenList.json'
import uniswapFixture from './fixtures/uniswapTokenList.json'

const usdcE = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'
const usdcEthereum = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

/** Serves fixtures by URL and records what was asked for. */
const makeFetchJson = (): { fetchJson: FetchJson; calls: string[] } => {
  const calls: string[] = []
  const routes: Array<[string, unknown]> = [
    [
      'https://coins.llama.fi/prices/current/polygon:' + usdcE,
      defillamaFixture
    ],
    ['https://tokens.uniswap.org', uniswapFixture],
    ['https://static.optimism.io/optimism.tokenlist.json', superchainFixture],
    [
      'https://api.gopluslabs.io/api/v1/token_security/137?contract_addresses=' +
        usdcE,
      goplusFixture
    ],
    ['https://api.rugcheck.xyz/v1/tokens/EPjF/report/summary', rugcheckFixture],
    [
      'https://lite-api.jup.ag/tokens/v2/search?query=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      jupiterFixture
    ],
    [
      'https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/assetlist.json',
      chainRegistryFixture
    ],
    [
      'https://pro-api.coingecko.com/api/v3/coins/list?include_platform=true',
      coingeckoListFixture
    ],
    [
      'https://pro-api.coingecko.com/api/v3/search?query=USDC',
      coingeckoSearchFixture
    ],
    [
      'https://pro-api.coingecko.com/api/v3/coins/usd-coin?',
      coingeckoCoinFixture
    ]
  ]
  const fetchJson: FetchJson = async url => {
    calls.push(url)
    for (const [prefix, body] of routes) {
      if (url.startsWith(prefix)) return { status: 200, body }
    }
    return { status: 404, body: { error: 'not found' } }
  }
  return { fetchJson, calls }
}

describe('evidence sources', function () {
  it('reads GoPlus flags and skips uncovered chains', function () {
    assert.equal(toGoPlusChainId('polygon', 137), '137')
    assert.equal(toGoPlusChainId('tron', undefined), 'tron')
    assert.isUndefined(toGoPlusChainId('botanix', 3637))
  })

  it('cleans a GoPlus reply', async function () {
    const { fetchJson } = makeFetchJson()
    const token = await fetchGoPlusToken(fetchJson, '137', usdcE)
    assert.equal(token?.is_honeypot, '0')
    assert.equal(token?.token_symbol, 'USDC')
    assert.equal(token?.dex[0].liquidity, '12345678.9')
    assert.isUndefined(token?.fake_token)
  })

  it('cleans a RugCheck summary and a Jupiter token', async function () {
    const { fetchJson } = makeFetchJson()
    const summary = await fetchRugCheckSummary(fetchJson, 'EPjF')
    assert.equal(summary?.score_normalised, 63)
    assert.equal(summary?.risks[0].level, 'danger')
    const token = await fetchJupiterToken(
      fetchJson,
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    )
    assert.equal(token?.symbol, 'USDC')
    assert.isTrue(token?.isVerified)
    assert.isUndefined(await fetchJupiterToken(fetchJson, 'missing'))
  })

  it('finds a chain-registry asset by denom with its trace', async function () {
    const { fetchJson } = makeFetchJson()
    const denom =
      'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858'
    const asset = await fetchChainRegistryAsset(fetchJson, 'osmosis', denom)
    assert.equal(asset?.coingeckoId, 'usd-coin')
    assert.deepEqual(asset?.traces, [
      { type: 'ibc', chainName: 'noble', baseDenom: 'uusdc' }
    ])
    assert.isUndefined(
      await fetchChainRegistryAsset(fetchJson, 'osmosis', 'uatom')
    )
  })

  it('derives bridge origins from both token list styles', async function () {
    const { fetchJson } = makeFetchJson()
    const lookup = makeTokenListLookup(fetchJson)
    const polygonHits = await lookup(137, usdcE)
    assert.equal(polygonHits.length, 1)
    assert.equal(polygonHits[0].list, 'uniswap')
    assert.deepEqual(polygonHits[0].bridgeInfo, [
      { chainId: 1, tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }
    ])
    const optimismHits = await lookup(
      10,
      '0x7f5c764cbc14f9669b88837ca1490cca17c31607'
    )
    assert.equal(optimismHits[0].list, 'superchain')
    assert.deepEqual(optimismHits[0].bridgeInfo, [
      { chainId: 1, tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }
    ])
    assert.deepEqual(await lookup(137, '0xdead'), [])
  })

  it('indexes CoinGecko addresses across platforms', async function () {
    const { fetchJson } = makeFetchJson()
    const client = makeCoingeckoClient({
      uri: 'https://pro-api.coingecko.com',
      apiKey: 'k',
      fetchJson
    })
    const index = await fetchAddressIndex(client, {
      'polygon-pos': 'polygon',
      ethereum: 'ethereum'
    })
    assert.deepEqual(
      index.get(usdcE)?.map(hit => [hit.id, hit.platformId, hit.pluginId]),
      [
        ['bridged-usdc-polygon-pos-bridge', 'polygon-pos', 'polygon'],
        ['fake-usdc', 'arbitrum-one', undefined]
      ]
    )
    assert.equal(index.get(usdcEthereum)?.length, 1)
  })
})

describe('gatherEvidence', function () {
  it('assembles the scripted evidence for a bridged token', async function () {
    const { fetchJson, calls } = makeFetchJson()
    const client = makeCoingeckoClient({
      uri: 'https://pro-api.coingecko.com',
      apiKey: 'k',
      fetchJson
    })
    const evidence = await gatherEvidence(
      {
        pluginId: 'polygon',
        tokenId: '2791bca1f2de4661ed88a30c99a7a9449aa84174'
      },
      {
        tokenTypes: { polygon: 'evm', ethereum: 'evm' },
        platforms: { polygon: 'polygon-pos', ethereum: 'ethereum' }
      },
      {
        fetchJson,
        coingecko: client,
        addressIndex: async () =>
          await fetchAddressIndex(client, {
            'polygon-pos': 'polygon',
            ethereum: 'ethereum'
          }),
        tokenLists: makeTokenListLookup(fetchJson),
        registry: issuerRegistry
      },
      { blind: true }
    )

    assert.equal(
      evidence.key,
      'polygon_2791bca1f2de4661ed88a30c99a7a9449aa84174'
    )
    assert.equal(evidence.address, usdcE)
    assert.deepEqual(evidence.chain, {
      pluginId: 'polygon',
      tokenType: 'evm',
      platformId: 'polygon-pos',
      evmChainId: 137,
      defiLlamaSlug: 'polygon'
    })
    assert.equal(evidence.issuerRegistry?.relationship, 'canonical_bridge')
    assert.equal(evidence.defiLlama?.symbol, 'USDC')
    assert.equal(evidence.defiLlama?.price, 0.9996)
    assert.equal(evidence.tokenLists[0].bridgeInfo[0].chainId, 1)
    assert.equal(evidence.goplus?.is_honeypot, '0')
    assert.isUndefined(evidence.etherscan)

    // Blind: the contract lookup is skipped and the polygon listing hidden
    assert.isUndefined(evidence.coingecko.contract)
    assert.isFalse(calls.some(url => url.includes('/contract/')))
    assert.deepEqual(
      evidence.coingecko.addressIndex.map(hit => hit.id),
      ['fake-usdc']
    )

    assert.deepEqual(
      evidence.coingecko.search.map(hit => hit.id),
      ['usd-coin', 'fake-usdc']
    )
    // The registry names usd-coin first; fake-usdc has no coin page
    assert.deepEqual(
      evidence.coingecko.candidates.map(coin => coin.id),
      ['usd-coin']
    )
    const [usdCoin] = evidence.coingecko.candidates
    assert.equal(usdCoin.priceUsd, 0.9998)
    assert.deepEqual(usdCoin.homepage, ['https://www.circle.com/en/usdc'])
    assert.deepEqual(usdCoin.categories, ['Stablecoins', 'USD Stablecoin'])
    assert.deepEqual(Object.keys(usdCoin.platforms), [
      'ethereum',
      'polygon-pos'
    ])
    assert.deepEqual(evidence.errors, [])
  })

  it('searches by pluginId for a native coin and records failing sources', async function () {
    const failing: FetchJson = async url => {
      if (url.includes('/search?query=wax'))
        return { status: 500, body: 'boom' }
      return { status: 404, body: {} }
    }
    const client = makeCoingeckoClient({
      uri: 'https://pro-api.coingecko.com',
      apiKey: 'k',
      fetchJson: failing
    })
    const evidence = await gatherEvidence(
      { pluginId: 'wax', tokenId: null },
      { tokenTypes: { wax: null }, platforms: { wax: null } },
      {
        fetchJson: failing,
        coingecko: client,
        addressIndex: async () => new Map(),
        tokenLists: async () => [],
        registry: issuerRegistry
      }
    )
    assert.isUndefined(evidence.address)
    assert.deepEqual(evidence.coingecko.candidates, [])
    assert.deepEqual(
      evidence.errors.map(error => error.source),
      ['coingecko:search']
    )
  })
})
