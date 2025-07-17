import { providers } from './providers/allProviders'
import {
  CryptoRateMap,
  FiatRateMap,
  GetRatesFunc,
  RateProvider,
  UpdateRatesParams
} from './types'
import { toCryptoRateKey, toFiatRateKey } from './utils'

const queryProviders = async (
  providers: RateProvider[],
  targetFiat: string,
  requestedCrypto: CryptoRateMap,
  requestedFiat: FiatRateMap
): Promise<{
  requestedCrypto: CryptoRateMap
  foundCrypto: CryptoRateMap
  requestedFiat: FiatRateMap
  foundFiat: FiatRateMap
}> => {
  const foundCrypto: CryptoRateMap = new Map()
  const foundFiat: FiatRateMap = new Map()

  for (const p of providers) {
    if (p.getFiatRates != null) {
      const { foundRates, requestedRates } = await p.getFiatRates({
        targetFiat,
        requestedRates: requestedFiat
      })

      // Save found rates
      foundRates.forEach((newRate, key) => {
        foundFiat.set(key, newRate)
      })
      // Update the remaining with just the queries with missing rates
      requestedFiat = requestedRates
    }
    if (p.getCryptoRates != null) {
      const { foundRates, requestedRates } = await p.getCryptoRates({
        targetFiat,
        requestedRates: requestedCrypto
      })

      // Save found rates
      foundRates.forEach((newRate, key) => {
        foundCrypto.set(key, newRate)
      })
      // Update the remaining with just the queries with missing rates
      requestedCrypto = requestedRates
    }
  }
  return {
    requestedCrypto,
    foundCrypto,
    requestedFiat,
    foundFiat
  }
}

const updateProviders = async (
  providers: RateProvider[],
  rates: UpdateRatesParams
): Promise<void> => {
  for (const p of providers) {
    if (p.updateRates != null) {
      await p.updateRates(rates)
    }
  }
}

export const getRates: GetRatesFunc = async params => {
  const { targetFiat } = params

  const requestedCrypto: CryptoRateMap = new Map()
  for (const cryptoRate of params.crypto) {
    requestedCrypto.set(toCryptoRateKey(cryptoRate), cryptoRate)
  }
  const requestedFiat: FiatRateMap = new Map()
  for (const fiatRate of params.fiat) {
    requestedFiat.set(toFiatRateKey(fiatRate), fiatRate)
  }

  const result = await queryProviders(
    providers,
    targetFiat,
    requestedCrypto,
    requestedFiat
  )

  await updateProviders(providers, {
    targetFiat,
    crypto: result.foundCrypto,
    fiat: result.foundFiat
  })

  return {
    targetFiat,
    crypto: [
      ...result.foundCrypto.values(),
      ...result.requestedCrypto.values()
    ],
    fiat: [...result.foundFiat.values(), ...result.requestedFiat.values()]
  }
}
