import { expect } from 'chai'

import { CryptoRate, TokenMap } from '../src/v3/types'
import { reduceRequestedCryptoRates } from '../src/v3/utils'

const mapping: TokenMap = {
  bitcoin_null: {
    id: 'BEETEESEE',
    slug: 'bitcoin'
  }
}
const makeRate = (isoDate: string, asset = null, rate = 1): CryptoRate => ({
  isoDate: new Date(isoDate),
  asset: { pluginId: 'bitcoin', tokenId: asset },
  rate
})

const rateList: CryptoRate[] = [
  {
    isoDate: new Date('2025-07-20T02:45:52.364Z'),
    asset: { pluginId: 'bitcoin', tokenId: null },
    rate: undefined
  },
  {
    isoDate: new Date('2025-07-20T02:46:28.364Z'),
    asset: { pluginId: 'bitcoin', tokenId: null },
    rate: undefined
  },
  {
    isoDate: new Date('2025-07-20T02:41:28.364Z'),
    asset: { pluginId: 'bitcoin', tokenId: null },
    rate: undefined
  },
  {
    isoDate: new Date('2025-07-20T02:40:28.364Z'),
    asset: { pluginId: 'bitcoin', tokenId: null },
    rate: undefined
  },
  {
    isoDate: new Date('2025-07-20T02:36:52.364Z'),
    asset: { pluginId: 'bitcoin', tokenId: null },
    rate: undefined
  },
  {
    isoDate: new Date('2025-07-19T12:00:00.000Z'),
    asset: { pluginId: 'bitcoin', tokenId: null },
    rate: undefined
  },
  {
    isoDate: new Date('2025-07-20T10:30:00.000Z'),
    asset: { pluginId: 'bitcoin', tokenId: null },
    rate: undefined
  },
  {
    isoDate: new Date('2025-07-18T23:59:59.999Z'),
    asset: { pluginId: 'bitcoin', tokenId: null },
    rate: undefined
  }
]

describe('reduceRequestedCryptoRates', () => {
  const intervalMs = 5 * 60 * 1000 // 5 minutes

  it('groups rates into correct buckets', () => {
    const rateMap = new Map(
      rateList.map(rate => [rate.isoDate.toISOString(), rate])
    )

    const result = reduceRequestedCryptoRates(rateMap, intervalMs, mapping)
    expect(result.size).equal(6)

    expect(result.get('2025-07-20T02:40:00.000Z')?.has('BEETEESEE')).equal(true)
    expect(result.get('2025-07-20T02:35:00.000Z')?.has('BEETEESEE')).equal(true)
  })

  it('handles empty input', () => {
    const result = reduceRequestedCryptoRates(new Map(), intervalMs, mapping)
    expect(result.size).equal(0)
  })

  it('assigns rate exactly on boundary to correct bucket', () => {
    const boundaryRate = makeRate('2025-07-20T02:45:00.000Z')
    const rateMap = new Map([
      [boundaryRate.isoDate.toISOString(), boundaryRate]
    ])

    const result = reduceRequestedCryptoRates(rateMap, intervalMs, mapping)
    expect(result.has('2025-07-20T02:45:00.000Z')).equal(true)
    expect(result.get('2025-07-20T02:45:00.000Z')?.has('BEETEESEE')).equal(true)
  })

  it('handles 24-hour interval correctly', () => {
    const dayIntervalMs = 24 * 60 * 60 * 1000 // 1 day

    const rateMap = new Map(
      rateList.map(rate => [rate.isoDate.toISOString(), rate])
    )

    const result = reduceRequestedCryptoRates(rateMap, dayIntervalMs, mapping)
    expect(result.size).to.equal(3)

    expect(result.get('2025-07-20T00:00:00.000Z')?.size).to.equal(1)
    expect(result.get('2025-07-20T00:00:00.000Z')?.has('BEETEESEE')).to.equal(
      true
    )

    expect(result.get('2025-07-19T00:00:00.000Z')?.size).to.equal(1)
    expect(result.get('2025-07-19T00:00:00.000Z')?.has('BEETEESEE')).to.equal(
      true
    )

    expect(result.get('2025-07-18T00:00:00.000Z')?.size).to.equal(1)
    expect(result.get('2025-07-18T00:00:00.000Z')?.has('BEETEESEE')).to.equal(
      true
    )
  })
})
