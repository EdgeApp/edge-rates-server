import type {
  FiatRateMap,
  NumberMap,
  RateBuckets,
  RateProvider,
  TokenMap
} from '../types'
import { expandReturnedCryptoRates, reduceRequestedCryptoRates } from '../utils'

/**
 * Tokens with no market price anywhere, redeemable 1:1 for the fiat in `id`.
 * Providers earlier in the list win, so a market price replaces the peg as soon
 * as a real source lists the token.
 */
const fiatPeggedTokens: TokenMap = {
  ethereum_8e9c32a536ab623a2e0e9961bce6f5fe7504e084: {
    id: 'EUR',
    displayName: 'Revolut Euro'
  },
  polygon_11b20f798b70df2201d8f550addcc3378b33dd4a: {
    id: 'EUR',
    displayName: 'Revolut Euro'
  }
}

/**
 * Prices fiat-pegged tokens at the rate of their fiat, asking the given fiat
 * providers in order so cached rates spare the third-party API.
 */
export const makeFiatPeggedRates = (
  fiatProviders: RateProvider[]
): RateProvider => ({
  providerId: 'fiatPeggedRates',
  type: 'api',
  getCryptoRates: async ({ targetFiat, requestedRates }, rightNow) => {
    if (targetFiat !== 'USD') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rateBuckets = reduceRequestedCryptoRates(
      requestedRates,
      rightNow,
      fiatPeggedTokens
    )

    let missingFiat: FiatRateMap = new Map()
    rateBuckets.forEach((fiatCodes, date) => {
      fiatCodes.forEach(fiatCode => {
        missingFiat.set(`${date}_${fiatCode}`, {
          isoDate: new Date(date),
          fiatCode,
          rate: undefined
        })
      })
    })

    const allResults: RateBuckets = new Map()
    for (const { getFiatRates } of fiatProviders) {
      if (getFiatRates == null || missingFiat.size === 0) continue
      const { foundRates, requestedRates: stillMissing } = await getFiatRates(
        { targetFiat, requestedRates: missingFiat },
        rightNow
      )
      foundRates.forEach(({ isoDate, fiatCode, rate }) => {
        if (rate == null) return
        const date = isoDate.toISOString()
        const dateResults: NumberMap = allResults.get(date) ?? {}
        dateResults[fiatCode] = rate
        allResults.set(date, dateResults)
      })
      missingFiat = stillMissing
    }

    const out = expandReturnedCryptoRates(
      requestedRates,
      rightNow,
      allResults,
      fiatPeggedTokens
    )

    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  }
})
