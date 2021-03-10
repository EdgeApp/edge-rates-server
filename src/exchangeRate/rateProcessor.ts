import bns from 'biggystring'

import { asRateDocument } from '../types/cleaners'
import {
  CurrencyRates,
  RateOptions,
  RateParams,
  RateProcessor,
  RateProvider,
  ServerState
} from '../types/types'
import { serverError } from '../utils/processor'

// export const loadProcessor = async (
//   load: OmitFirstArg<DbLoadFunction>,
//   params: RateParams | RateParams[],
//   documents: InitState = {}
// ): Promise<RateProcessorResponse> => {
//   const queries = Array.isArray(params) ? params : [params]
//   const stateTemplate: InitState = queries.reduce(
//     (docIds, { date }) => ({ [date]: {}, ...docIds }),
//     documents
//   )
//   return (load(stateTemplate) as Promise<RatesProcessorState>)
//     .then(documents => ({ documents }))
//     .catch(e => ({ error: serverError(params, e.message, 'db_error') }))
// }

export const fromProvider = async (
  provider: RateProvider,
  rateParams: RateParams,
  rateState: ServerState<CurrencyRates>
): Promise<ReturnType<RateProcessor>> => {
  const { currencyPair, date } = rateParams
  const rateDoc = { ...asRateDocument(rateParams)(rateState) }
  const response: ReturnType<RateProcessor> = { state: { [date]: rateDoc } }

  try {
    const rate = await provider(rateParams)
    if (rate == null) throw new Error('not_found')
    rateDoc[currencyPair] = rate
    response.result = { date, currency_pair: currencyPair, exchangeRate: rate }
  } catch (e) {
    response.error = serverError(
      rateParams,
      e.message === 'not_found'
        ? 'lookup failed to find exchange rate for this query'
        : e.message,
      'not_found',
      400
    )
  }
  return response
}

// Try to get the rate from any of the providers using bridged currencies.
export const getBridgedRate = async (
  { bridgeCurrencies = ['USD', 'BTC'] }: RateOptions,
  provider: RateProvider,
  rateParams: RateParams,
  currencyRates: ServerState<CurrencyRates>
): Promise<ReturnType<RateProcessor>> => {
  const { currencyA, currencyB, currencyPair, date } = rateParams
  // Clone the current 'currencyRates' if exist or create a new one
  const rates = { ...(currencyRates ?? { _id: date }) }
  // Try to find a bridged rate using any of the BrigedPairs
  for (const bridged of bridgeCurrencies) {
    // No need to check if one of the currencies is the bridged currency
    if (currencyA === bridged || currencyB === bridged) continue
    // Create BrigedPairs
    const pairA = `${currencyA}_${bridged}`
    const pairB = `${bridged}_${currencyB}`
    // Try to get the 'rate' from a provider and add it to the rates object
    const getRate: any = async params =>
      await provider({ ...rateParams, ...params })
        .then(r => r ?? Object.assign(rates, { [params.currencyPair]: r }))
        .catch(() => null)
    // Try to get both sides of the bridged currency
    await Promise.all([
      rates[pairA] ?? getRate({ currencyB: bridged, currencyPair: pairA }),
      rates[pairB] ?? getRate({ currencyA: bridged, currencyPair: pairB })
    ])
    // If we got both sides, combine them and return
    if (rates[pairA] != null && rates[pairB] != null) {
      rates[currencyPair] = bns.mul(rates[pairA], rates[pairB])
      return { result: rates[currencyPair], state: rates }
    }
  }
  // If no response, return the rates
  return { state: rates }
}
