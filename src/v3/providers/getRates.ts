import {
  GetRatesFunc,
  GetRatesFuncReturn,
  GetRatesParams,
  RateProvider
} from '../types'
import { coingecko } from './coingecko'
import { coinmarketcap } from './coinmarketcap'
import { couch } from './couch'
import { redis } from './redis'

const rateProviders: RateProvider[] = [redis, couch, coingecko, coinmarketcap]
const memoryProviders = rateProviders.filter(p => p.type === 'memory')
const dbProviders = rateProviders.filter(p => p.type === 'db')
const apiProviders = rateProviders.filter(p => p.type === 'api')

const queryProviders = async (
  providers: RateProvider[],
  params: GetRatesParams,
  out: GetRatesFuncReturn
): Promise<GetRatesFuncReturn> => {
  const { targetFiat } = params
  const newValues: GetRatesFuncReturn = {
    fiat: [],
    crypto: []
  }
  for (const p of providers) {
    if (p.getFiatRates != null) {
      const newFiat = await p.getFiatRates({ targetFiat, rates: params.fiat })
      // Save any newly added rates for return
      newValues.fiat = [
        ...newValues.fiat,
        ...newFiat.filter(r => r.rate != null)
      ]

      // Update the remaining with just the queries with missing rates
      params.fiat = out.fiat.filter(r => r.rate == null)
    }
    if (p.getCryptoRates != null) {
      const newCrypto = await p.getCryptoRates({
        targetFiat,
        rates: params.crypto
      })
      newValues.crypto = [
        ...newValues.crypto,
        ...newCrypto.filter(r => r.rate != null)
      ]
      params.crypto = out.crypto.filter(r => r.rate == null)
    }
  }
  // Add the newValues to the out object
  out.fiat = [...out.fiat, ...newValues.fiat]
  out.crypto = [...out.crypto, ...newValues.crypto]
  return out
}

const updateProviders = async (
  providers: RateProvider[],
  rates: GetRatesParams
): Promise<void> => {
  for (const p of providers) {
    if (p.updateRates != null) {
      await p.updateRates(rates)
    }
  }
}

export const getRates: GetRatesFunc = async params => {
  const { targetFiat } = params
  const out: GetRatesFuncReturn = {
    crypto: [],
    fiat: []
  }
  // First try memory providers
  await queryProviders(memoryProviders, params, out)
  if (params.crypto.length === 0 && params.fiat.length === 0) return out

  // Next try database providers
  const dbResult = await queryProviders(dbProviders, params, out)

  // Finally try all the API providers
  const apiResult = await queryProviders(apiProviders, params, out)

  // Update the db with apiResult
  await updateProviders(dbProviders, { ...apiResult, targetFiat })

  // Update memory with api and db results
  dbResult.crypto = [...dbResult.crypto, ...apiResult.crypto]
  dbResult.fiat = [...dbResult.fiat, ...apiResult.fiat]
  await updateProviders(memoryProviders, { ...dbResult, targetFiat })

  return out
}
