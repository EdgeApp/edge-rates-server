import { expect } from 'chai'

import { makeFiatPeggedRates } from '../src/v3/providers/fiatPeggedRates'
import type { CryptoRateMap, FiatRateMap, RateProvider } from '../src/v3/types'
import { expandReturnedFiatRates } from '../src/v3/utils'

const rightNow = new Date('2026-11-01T12:00:30.000Z')
const CURRENT = '2026-11-01T12:00:00.000Z'
const HISTORICAL = '2026-10-01T12:00:00.000Z'

const ethereumEurr = '8e9c32a536ab623a2e0e9961bce6f5fe7504e084'
const polygonEurr = '11b20f798b70df2201d8f550addcc3378b33dd4a'

const makeRequest = (
  assets: Array<[string, string | null, string]>
): CryptoRateMap => {
  const out: CryptoRateMap = new Map()
  for (const [pluginId, tokenId, isoDate] of assets) {
    out.set(`${isoDate}_${pluginId}_${tokenId ?? ''}`, {
      isoDate: new Date(isoDate),
      asset: { pluginId, tokenId },
      rate: undefined
    })
  }
  return out
}

const makeFiatProvider = (
  ratesByDay: Record<string, Record<string, number>>,
  calls: FiatRateMap[] = []
): RateProvider => ({
  providerId: 'fakeFiat',
  type: 'api',
  getFiatRates: async ({ requestedRates }) => {
    calls.push(requestedRates)
    return expandReturnedFiatRates(
      requestedRates,
      new Map(Object.entries(ratesByDay))
    )
  }
})

const getCryptoRates = async (
  provider: RateProvider,
  requestedRates: CryptoRateMap,
  targetFiat = 'USD'
): ReturnType<NonNullable<RateProvider['getCryptoRates']>> => {
  if (provider.getCryptoRates == null) throw new Error('No getCryptoRates')
  return await provider.getCryptoRates({ targetFiat, requestedRates }, rightNow)
}

describe('fiatPeggedRates', () => {
  const currentDay = { '2026-11-01T00:00:00.000Z': { EUR: 1.12 } }

  it('prices the EURR contracts at the EUR rate on both chains', async () => {
    const request = makeRequest([
      ['ethereum', ethereumEurr, CURRENT],
      ['polygon', polygonEurr, CURRENT]
    ])
    const out = await getCryptoRates(
      makeFiatPeggedRates([makeFiatProvider(currentDay)]),
      request
    )
    expect(out.requestedRates.size).to.equal(0)
    expect(Array.from(out.foundRates.values()).map(r => r.rate)).to.deep.equal([
      1.12, 1.12
    ])
  })

  it('leaves other assets for later providers', async () => {
    const calls: FiatRateMap[] = []
    const request = makeRequest([
      ['ethereum', 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', CURRENT],
      ['bitcoin', null, CURRENT]
    ])
    const out = await getCryptoRates(
      makeFiatPeggedRates([makeFiatProvider(currentDay, calls)]),
      request
    )
    expect(out.foundRates.size).to.equal(0)
    expect(out.requestedRates.size).to.equal(2)
    expect(calls.length).to.equal(0)
  })

  it('uses the EUR rate of the requested day', async () => {
    const request = makeRequest([['ethereum', ethereumEurr, HISTORICAL]])
    const out = await getCryptoRates(
      makeFiatPeggedRates([
        makeFiatProvider({
          ...currentDay,
          '2026-10-01T00:00:00.000Z': { EUR: 1.05 }
        })
      ]),
      request
    )
    expect(Array.from(out.foundRates.values())[0].rate).to.equal(1.05)
  })

  it('asks the next provider only for what is still missing', async () => {
    const calls: FiatRateMap[] = []
    const request = makeRequest([
      ['ethereum', ethereumEurr, CURRENT],
      ['ethereum', ethereumEurr, HISTORICAL]
    ])
    const out = await getCryptoRates(
      makeFiatPeggedRates([
        makeFiatProvider(currentDay),
        makeFiatProvider({ '2026-10-01T00:00:00.000Z': { EUR: 1.05 } }, calls)
      ]),
      request
    )
    expect(out.requestedRates.size).to.equal(0)
    expect(calls.length).to.equal(1)
    expect(calls[0].size).to.equal(1)
    expect(Array.from(calls[0].values())[0].isoDate.toISOString()).to.equal(
      HISTORICAL
    )
  })

  it('reports the token missing when no provider has the rate', async () => {
    const request = makeRequest([['ethereum', ethereumEurr, CURRENT]])
    const out = await getCryptoRates(
      makeFiatPeggedRates([makeFiatProvider({})]),
      request
    )
    expect(out.foundRates.size).to.equal(0)
    expect(out.requestedRates.size).to.equal(1)
  })

  it('only answers for a USD target', async () => {
    const calls: FiatRateMap[] = []
    const request = makeRequest([['ethereum', ethereumEurr, CURRENT]])
    const out = await getCryptoRates(
      makeFiatPeggedRates([makeFiatProvider(currentDay, calls)]),
      request,
      'EUR'
    )
    expect(out.foundRates.size).to.equal(0)
    expect(calls.length).to.equal(0)
  })
})
