import { assert } from 'chai'
import { describe, it } from 'mocha'

import {
  issuerRegistry,
  lookupIssuerRegistry
} from '../../src/v3/providers/assetResolver/evidence/issuerRegistry'
import { tokenIdToAddress } from '../../src/v3/providers/assetResolver/tokenAddress'

describe('tokenIdToAddress', function () {
  it('restores the 0x prefix on EVM ids', function () {
    assert.equal(
      tokenIdToAddress('evm', 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    )
  })

  it('passes plain ids through', function () {
    assert.equal(tokenIdToAddress('simple', 'EPjFWdd5'), 'EPjFWdd5')
    assert.equal(tokenIdToAddress('lowercase', 'abc'), 'abc')
    assert.equal(tokenIdToAddress('xrpl', 'USD-rIssuer'), 'USD-rIssuer')
  })

  it('restores the slash in IBC denoms and keeps native denoms', function () {
    const hash =
      'D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858'
    assert.equal(tokenIdToAddress('cosmos', `ibc${hash}`), `ibc/${hash}`)
    assert.equal(tokenIdToAddress('cosmos', 'uosmo'), 'uosmo')
  })

  it('cannot recover lossy or unsupported ids', function () {
    assert.isUndefined(tokenIdToAddress('colon-delimited', '0x2sui'))
    assert.isUndefined(tokenIdToAddress(null, 'anything'))
  })
})

describe('lookupIssuerRegistry', function () {
  it('finds native issuance', function () {
    const hit = lookupIssuerRegistry(
      issuerRegistry,
      'ethereum',
      'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    )
    assert.deepEqual(hit, {
      coingeckoId: 'usd-coin',
      issuer: 'Circle',
      symbol: 'USDC',
      source: 'https://www.circle.com/multi-chain-usdc',
      relationship: 'native_issuance'
    })
  })

  it('finds canonical bridge representations, ignoring case', function () {
    const hit = lookupIssuerRegistry(
      issuerRegistry,
      'polygon',
      '2791BCA1F2DE4661ED88A30C99A7A9449AA84174'
    )
    assert.equal(hit?.coingeckoId, 'usd-coin')
    assert.equal(hit?.relationship, 'canonical_bridge')
  })

  it('finds nothing for other assets', function () {
    assert.isUndefined(lookupIssuerRegistry(issuerRegistry, 'polygon', 'dead'))
    assert.isUndefined(lookupIssuerRegistry(issuerRegistry, 'polygon', null))
    assert.isUndefined(
      lookupIssuerRegistry(issuerRegistry, 'polygon', undefined)
    )
  })
})
