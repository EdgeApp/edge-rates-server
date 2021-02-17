import {
  asArray,
  asMap,
  asObject,
  asOptional,
  asString,
  Cleaner,
  ObjectShape
} from 'cleaners'

import { exchangesBatchLimit } from '../serverConfig.json'
import { normalizeDate } from './utils'

export type ErrorType = 'not_found' | 'conflict' | 'db_error' | 'bad_query'

export interface RateParams {
  currencyA: string
  currencyB: string
  currencyPair: string
  date: string
}
export interface RateError extends RateParams {
  message: string
  errorCode: number
  errorType: ErrorType
}
export interface ReturnRateUserResponse {
  date?: string
  currencyPair?: string
  exchangeRate?: string
  error?: RateError
}

export interface RatesDocument {
  _id: string
  [currencyPair: string]: string
}

export interface ReturnGetRate {
  rate?: string
  document?: RatesDocument
  error?: RateError
}

export interface ReturnGetRates {
  documents: { [_id: string]: RatesDocument }
  results: ReturnRateUserResponse[]
}

export interface ProviderConfig {
  url: string
  apiKey?: string
}

export type ProviderFetch = (rateParams: RateParams) => Promise<string | null>

export interface Provider {
  fetchRate: ProviderFetch
  validRequest: (ratesParams: RateParams) => boolean
}

export const asObjectMap = <T>(
  obj: ObjectShape<T>
): Cleaner<{ [key: string]: T }> => asMap(asObject(obj))

export const asExchangeRateReq = asObject({
  currency_pair: asString,
  date: asOptional(asString)
})

export const asRateParam = (param: any): RateParams => {
  const { currency_pair: currencyPair, date } = asExchangeRateReq(param)
  const dateStr = date ?? new Date().toISOString()

  const currencyPairUpper = currencyPair.toUpperCase()
  const currencyTokens = currencyPairUpper.split('_')

  if (currencyTokens.length !== 2) {
    throw new Error(
      'currency_pair query param malformed. should be [curA]_[curB], ex: "ETH_USD"'
    )
  }
  const currencyA = currencyTokens[0]
  const currencyB = currencyTokens[1]
  const parsedDate = normalizeDate(dateStr)
  if (parsedDate == null) {
    throw new Error(
      'date query param malformed. should be conventional date string, ex:"2019-11-21T15:28:21.123Z"'
    )
  }
  if (Date.parse(parsedDate) > Date.now()) {
    throw new Error(`Future date received: ${parsedDate}. Must send past date.`)
  }
  return {
    currencyA,
    currencyB,
    currencyPair: currencyPairUpper,
    date: parsedDate
  }
}

export const asExchangeRatesReq = asArray(asRateParam)

export const asRatesParams = (params: any): RateParams[] => {
  const results = asExchangeRatesReq(params)
  if (results.length > exchangesBatchLimit) {
    throw new Error(`Exceeded Limit of ${exchangesBatchLimit}`)
  }
  return results
}
