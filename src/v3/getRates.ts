import {
  apiProviders,
  dbProviders,
  memoryProviders
} from './providers/allProviders'
import {
  CryptoRateMap,
  FiatRateMap,
  GetRatesFunc,
  RateProvider,
  UpdateRatesParams
} from './types'
import { toCryptoKey } from './utils'

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
    const promises: Array<Promise<void>> = []
    if (p.getFiatRates != null && requestedFiat.size > 0) {
      promises.push(
        p
          .getFiatRates({
            targetFiat,
            requestedRates: requestedFiat
          })
          .then(({ foundRates, requestedRates }) => {
            foundRates.forEach((newRate, key) => {
              foundFiat.set(key, newRate)
            })
            requestedFiat = requestedRates
          })
          .catch(e => {
            console.error(`Error getting rates from ${p.providerId}`, e)
          })
      )
    }
    if (p.getCryptoRates != null && requestedCrypto.size > 0) {
      promises.push(
        p
          .getCryptoRates({
            targetFiat,
            requestedRates: requestedCrypto
          })
          .then(({ foundRates, requestedRates }) => {
            foundRates.forEach((newRate, key) => {
              foundCrypto.set(key, newRate)
            })
            requestedCrypto = requestedRates
          })
          .catch(e => {
            console.error(`Error getting rates from ${p.providerId}`, e)
          })
      )
    }
    await Promise.all(promises)
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
      p.updateRates(rates).catch(err =>
        console.error(`Error updating rates from ${p.providerId}`, err)
      )
    }
  }
}

export const getRates: GetRatesFunc = async params => {
  const { targetFiat } = params

  const requestedCrypto: CryptoRateMap = new Map()
  for (const cryptoRate of params.crypto) {
    requestedCrypto.set(
      `${cryptoRate.isoDate.toISOString()}_${toCryptoKey(cryptoRate.asset)}`,
      cryptoRate
    )
  }
  const requestedFiat: FiatRateMap = new Map()
  for (const fiatRate of params.fiat) {
    requestedFiat.set(
      `${fiatRate.isoDate.toISOString()}_${fiatRate.fiatCode}`,
      fiatRate
    )
  }

  const memoryResults = await queryProviders(
    memoryProviders,
    targetFiat,
    requestedCrypto,
    requestedFiat
  )
  const dbResults = await queryProviders(
    dbProviders,
    targetFiat,
    memoryResults.requestedCrypto,
    memoryResults.requestedFiat
  )
  const apiResults = await queryProviders(
    apiProviders,
    targetFiat,
    dbResults.requestedCrypto,
    dbResults.requestedFiat
  )

  // Update redis with db and api data
  updateProviders(memoryProviders, {
    targetFiat,
    crypto: new Map([...dbResults.foundCrypto, ...apiResults.foundCrypto]),
    fiat: new Map([...dbResults.foundFiat, ...apiResults.foundFiat])
  }).catch(e => {
    console.error('Error updating memoryproviders', e)
  })

  // Update db with api data
  updateProviders(dbProviders, {
    targetFiat,
    crypto: apiResults.foundCrypto,
    fiat: apiResults.foundFiat
  }).catch(e => {
    console.error('Error updating dbproviders', e)
  })

  return {
    targetFiat,
    crypto: [
      ...memoryResults.foundCrypto.values(),
      ...dbResults.foundCrypto.values(),
      ...apiResults.foundCrypto.values(),
      ...apiResults.requestedCrypto.values()
    ],
    fiat: [
      ...memoryResults.foundFiat.values(),
      ...dbResults.foundFiat.values(),
      ...apiResults.foundFiat.values(),
      ...apiResults.requestedFiat.values()
    ]
  }
}
