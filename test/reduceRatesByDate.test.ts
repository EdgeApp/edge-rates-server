import { expect } from 'chai'

import type { CryptoRate, FiatRate, TokenMap } from '../src/v3/types'
import {
  reduceRequestedCryptoRates,
  reduceRequestedFiatRates
} from '../src/v3/utils'

const mapping: TokenMap = {
  bitcoin: {
    id: 'BEETEESEE',
    displayName: 'Bitcoin'
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
const fiatRateList: FiatRate[] = [
  {
    isoDate: new Date('2025-07-20T02:45:52.364Z'),
    fiatCode: 'USD',
    rate: undefined
  },
  {
    isoDate: new Date('2025-07-20T02:46:28.364Z'),
    fiatCode: 'USD',
    rate: undefined
  },
  {
    isoDate: new Date('2025-07-20T02:41:28.364Z'),
    fiatCode: 'USD',
    rate: undefined
  },
  {
    isoDate: new Date('2025-07-20T02:40:28.364Z'),
    fiatCode: 'USD',
    rate: undefined
  },
  {
    isoDate: new Date('2025-07-20T02:36:52.364Z'),
    fiatCode: 'USD',
    rate: undefined
  },
  {
    isoDate: new Date('2025-07-19T12:00:00.000Z'),
    fiatCode: 'USD',
    rate: undefined
  },
  {
    isoDate: new Date('2025-07-20T10:30:00.000Z'),
    fiatCode: 'USD',
    rate: undefined
  },
  {
    isoDate: new Date('2025-07-18T23:59:59.999Z'),
    fiatCode: 'USD',
    rate: undefined
  }
]

describe('reduceRequestedCryptoRates', () => {
  const rightNow = new Date()

  it('groups rates into correct buckets', () => {
    const rateMap = new Map(
      rateList.map(rate => [rate.isoDate.toISOString(), rate])
    )

    const result = reduceRequestedCryptoRates(rateMap, rightNow, mapping)
    expect(result.size).equal(6)

    expect(result.get('2025-07-20T02:40:00.000Z')?.has('BEETEESEE')).equal(true)
    expect(result.get('2025-07-20T02:35:00.000Z')?.has('BEETEESEE')).equal(true)
  })

  it('handles empty input', () => {
    const result = reduceRequestedCryptoRates(new Map(), rightNow, mapping)
    expect(result.size).equal(0)
  })

  it('assigns rate exactly on boundary to correct bucket', () => {
    const boundaryRate = makeRate('2025-07-20T02:45:00.000Z')
    const rateMap = new Map([
      [boundaryRate.isoDate.toISOString(), boundaryRate]
    ])

    const result = reduceRequestedCryptoRates(rateMap, rightNow, mapping)
    expect(result.has('2025-07-20T02:45:00.000Z')).equal(true)
    expect(result.get('2025-07-20T02:45:00.000Z')?.has('BEETEESEE')).equal(true)
  })

  it('handles 24-hour interval correctly', () => {
    const rateMap = new Map(
      fiatRateList.map(rate => [rate.isoDate.toISOString(), rate])
    )

    const result = reduceRequestedFiatRates(rateMap, rightNow)
    expect(result.size).to.equal(3)

    expect(result.get('2025-07-20T00:00:00.000Z')?.size).to.equal(1)
    expect(result.get('2025-07-20T00:00:00.000Z')?.has('USD')).to.equal(true)

    expect(result.get('2025-07-19T00:00:00.000Z')?.size).to.equal(1)
    expect(result.get('2025-07-19T00:00:00.000Z')?.has('USD')).to.equal(true)

    expect(result.get('2025-07-18T00:00:00.000Z')?.size).to.equal(1)
    expect(result.get('2025-07-18T00:00:00.000Z')?.has('USD')).to.equal(true)
  })

  it('filters out far future dates', () => {
    const rightNow = new Date('2025-07-20T02:45:00.000Z')

    // Far future dates (1 hour, 1 day) should be filtered out
    const farFutureRates: CryptoRate[] = [
      makeRate('2025-07-20T03:45:00.000Z'), // 1 hour in future
      makeRate('2025-07-21T02:45:00.000Z'), // 1 day in future
      makeRate('2025-07-25T02:45:00.000Z') // 5 days in future
    ]

    // Current/past dates should be included
    const validRates: CryptoRate[] = [
      makeRate('2025-07-20T02:44:00.000Z'), // 1 minute ago
      makeRate('2025-07-20T02:40:00.000Z'), // 5 minutes ago
      makeRate('2025-07-19T02:45:00.000Z') // 1 day ago
    ]

    const rateMap = new Map(
      [...farFutureRates, ...validRates].map(rate => [
        rate.isoDate.toISOString(),
        rate
      ])
    )

    const result = reduceRequestedCryptoRates(rateMap, rightNow, mapping)

    // Verify far future dates are not in the result
    const resultKeys = Array.from(result.keys())
    expect(resultKeys).to.not.include('2025-07-20T03:45:00.000Z')
    expect(resultKeys).to.not.include('2025-07-21T02:45:00.000Z')
    expect(resultKeys).to.not.include('2025-07-25T02:45:00.000Z')

    // Verify valid dates are in the result (may be bucketed)
    // 3 valid rates: 02:44:00 (1 min ago), 02:40:00 (5 min ago), 02:45:00 yesterday
    // 02:44:00 -> bucketed to 02:44:00 (within 5 min, minute precision)
    // 02:40:00 -> bucketed to 02:40:00 (within 5 min, minute precision)
    // 02:45:00 yesterday -> bucketed to 02:45:00 (historical, 5 min precision)
    expect(result.size).to.equal(3) // Should have 3 buckets for the valid rates
  })

  it('accepts slightly future dates within fuzz factor', () => {
    const rightNow = new Date('2025-07-20T02:45:00.000Z')

    // Dates slightly in the future (within 1 minute fuzz factor) should be accepted
    // Note: dates exactly at 1 minute (02:46:00) are also accepted (not filtered)
    const slightlyFutureRates: CryptoRate[] = [
      makeRate('2025-07-20T02:45:30.000Z'), // 30 seconds in future
      makeRate('2025-07-20T02:45:59.000Z'), // 59 seconds in future
      makeRate('2025-07-20T02:45:59.999Z'), // Just under 1 minute in future
      makeRate('2025-07-20T02:46:00.000Z') // Exactly 1 minute in future (accepted)
    ]

    // Dates beyond the boundary should be filtered
    const beyondBoundaryRates: CryptoRate[] = [
      makeRate('2025-07-20T02:46:00.001Z'), // Just over 1 minute in future (filtered)
      makeRate('2025-07-20T02:46:01.000Z') // 1 minute 1 second in future (filtered)
    ]

    const rateMap = new Map(
      [...slightlyFutureRates, ...beyondBoundaryRates].map(rate => [
        rate.isoDate.toISOString(),
        rate
      ])
    )

    const result = reduceRequestedCryptoRates(rateMap, rightNow, mapping)

    // All slightly future dates (including exactly 1 minute) should be accepted
    // 4 accepted rates: 02:45:30, 02:45:59, 02:45:59.999, 02:46:00
    // All within 5 minutes, so use minute precision:
    // 02:45:30 -> bucketed to 02:45:00
    // 02:45:59 -> bucketed to 02:45:00
    // 02:45:59.999 -> bucketed to 02:45:00
    // 02:46:00 -> bucketed to 02:46:00
    expect(result.size).to.equal(2) // Should have 2 buckets (02:45:00 and 02:46:00)
  })

  it('handles mixed past, current, and future dates', () => {
    const rightNow = new Date('2025-07-20T02:45:00.000Z')

    const mixedRates: CryptoRate[] = [
      makeRate('2025-07-20T02:40:00.000Z'), // 5 minutes ago (past)
      makeRate('2025-07-20T02:44:30.000Z'), // 30 seconds ago (past)
      makeRate('2025-07-20T02:45:00.000Z'), // Current time
      makeRate('2025-07-20T02:45:30.000Z'), // 30 seconds future (within fuzz, accepted)
      makeRate('2025-07-20T02:46:00.000Z'), // Exactly 1 minute future (accepted, at boundary)
      makeRate('2025-07-20T02:46:00.001Z'), // Just over 1 minute future (filtered)
      makeRate('2025-07-20T03:00:00.000Z') // 15 minutes future (filtered)
    ]

    const rateMap = new Map(
      mixedRates.map(rate => [rate.isoDate.toISOString(), rate])
    )

    const result = reduceRequestedCryptoRates(rateMap, rightNow, mapping)

    // Should include past, current, and dates up to exactly 1 minute in future
    // Dates beyond 1 minute are filtered
    // 5 accepted rates: 02:40:00 (5 min ago), 02:44:30 (30 sec ago), 02:45:00 (current),
    //                   02:45:30 (30 sec future), 02:46:00 (1 min future)
    // All within 5 minutes, so use minute precision:
    // 02:40:00 -> bucketed to 02:40:00
    // 02:44:30 -> bucketed to 02:44:00
    // 02:45:00 -> bucketed to 02:45:00
    // 02:45:30 -> bucketed to 02:45:00
    // 02:46:00 -> bucketed to 02:46:00
    expect(result.size).to.equal(4) // Should have 4 buckets

    // Verify far future dates (15 minutes) are filtered out
    // We can't check exact bucket keys since dates are normalized, but we can verify
    // that the result doesn't contain buckets for the far future dates
    const resultKeys = Array.from(result.keys())
    // 03:00:00 should not appear since it's far in the future
    const hasFarFuture = resultKeys.some(key =>
      key.startsWith('2025-07-20T03:')
    )
    expect(hasFarFuture).to.equal(false)
  })
})
