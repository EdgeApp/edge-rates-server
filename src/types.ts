import { asMap, asObject, asOptional, asString } from 'cleaners'

import { normalizeDate } from './utils'

export type ErrorType = 'not_found' | 'conflict' | 'db_error'
export interface RateError extends Error {
  errorCode?: number
  errorType?: ErrorType
}

export interface RateParams {
  currencyA: string
  currencyB: string
  currencyPair: string
  date: string
}
export interface ReturnRateUserResponse {
  date?: string
  exchangeRate?: string
}
export interface ReturnRate {
  data?: ReturnRateUserResponse
  document?: any
  error?: Error
}

export interface ReturnGetRate {
  rate?: string
  document?: any
  error?: RateError
}
export interface RatesDocument {
  _id: string
  [currencyPair: string]: string
}

export interface ProviderConfig {
  url: string
  apiKey?: string
}

export type ProviderFetch = (rateParams: RateParams) => Promise<string | void>

export interface Provider {
  fetchRate: ProviderFetch
  validRequest: (ratesParams: RateParams) => boolean
}

export const asExchangeRatesReq = asMap(asString)
export const asExchangeRateReq = asObject({
  currency_pair: asString,
  date: asOptional(asString)
})

export const asRateParam = (param: any): RateParams => {
  try {
    const { currency_pair: currencyPair, date } = asExchangeRateReq(param)
    let dateStr: string
    if (typeof date === 'string') {
      dateStr = date
    } else {
      dateStr = new Date().toISOString()
    }
    if (typeof currencyPair !== 'string' || typeof dateStr !== 'string') {
      throw new Error(
        'Missing or invalid query param(s): currency_pair and date should both be strings'
      )
    }
    const currencyTokens = currencyPair.split('_')
    if (currencyTokens.length !== 2) {
      throw new Error(
        'currency_pair query param malformed.  should be [curA]_[curB], ex: "ETH_USD"'
      )
    }
    const currencyA = currencyTokens[0]
    const currencyB = currencyTokens[1]
    const parsedDate = normalizeDate(dateStr)
    if (parsedDate == null) {
      throw new Error(
        'date query param malformed.  should be conventional date string, ex:"2019-11-21T15:28:21.123Z"'
      )
    }
    if (Date.parse(parsedDate) > Date.now()) {
      throw new Error('Future date received. Must send past date.')
    }
    return { currencyA, currencyB, currencyPair, date: parsedDate }
  } catch (e) {
    e.errorCode = 400
    throw e
  }
}
