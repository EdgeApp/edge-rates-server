import {
  asArray,
  asBoolean,
  asMap,
  asNumber,
  asObject,
  asOptional,
  asString,
  Cleaner,
  ObjectShape
} from 'cleaners'

import { config } from './config'
import { normalizeDate } from './utils'

const ERRORS = ['not_found', 'conflict', 'db_error', 'bad_query']

/// ///////////// ///
/// /// Types /// ///
/// ///////////// ///
export type ErrorType = ReturnType<typeof asErrorType>
export type CurrencyRates = ReturnType<typeof asCurrencyRates>
export interface RateParams {
  currencyA: string
  currencyB: string
  currencyPair: string
  date: string
}

export type RateError = ReturnType<typeof asRateError>
export type ReturnRateUserResponse = Partial<
  ReturnType<typeof asReturnRateUserResponse>
>
export type RatesDocument = ReturnType<typeof asRatesDocument>
export type ReturnGetRate = Partial<ReturnType<typeof asReturnGetRate>>
export interface ReturnGetRates {
  documents: { [_id: string]: RatesDocument }
  results: ReturnRateUserResponse[]
}
export type ZeroRateCurrencyCodes = ReturnType<typeof asZeroRateCurrencyCodes>
export type ProviderConfig = ReturnType<typeof asProviderConfig>
export type ServerConfig = ReturnType<typeof asServerConfig>

export type RateGetterOptions = Partial<
  ServerConfig & { exchanges: ProviderFetch[]; localDb: any }
>

export type RateGetterFull = (
  options: RateGetterOptions,
  rateParams: RateParams,
  document: RatesDocument
) => ReturnGetRate | Promise<ReturnGetRate>

export type RateGetter = (
  rateParams: RateParams,
  document: RatesDocument
) => ReturnGetRate | Promise<ReturnGetRate>

export type ProviderFetch = (rateParams: RateParams) => Promise<string | null>

/// ////////////// ///
/// // Cleaners // ///
/// ////////////// ///
export const asObjectMap = <T>(
  obj: ObjectShape<T>
): Cleaner<{ [key: string]: T }> => asMap(asObject(obj))

export const asMapWithProps = <T, G>({
  map,
  props
}: {
  map: Cleaner<T>
  props: ObjectShape<G>
}) => obj => {
  const result = asMap(map)(obj)
  return { ...result, ...asObject(props)(obj) }
}

export const asErrorType = (errorType: any): string => {
  const str = asString(errorType)
  if (!ERRORS.includes(str)) {
    throw new Error('Unknown error type')
  }
  return str
}

export const asRateParams: Cleaner<RateParams> = (param: any) => {
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
    throw new Error(`Future date received. Must send past date.`)
  }
  return {
    currencyA,
    currencyB,
    currencyPair: currencyPairUpper,
    date: parsedDate
  }
}

export const asRateError = asObject({
  ...asRateParams,
  message: asString,
  errorCode: asNumber,
  errorType: asErrorType
})

export const asReturnRateUserResponse = asObject({
  date: asOptional(asString),
  currencyPair: asOptional(asString),
  exchangeRate: asOptional(asString),
  error: asOptional(asRateError)
})

export const asCurrencyRates = asMap(asString)
export const asRatesDocument = asMapWithProps({
  map: asString,
  props: { _id: asString }
})

export const asReturnGetRate = asObject({
  rate: asOptional(asString),
  document: asOptional(asRatesDocument),
  error: asOptional(asRateError)
})

export const asReturnGetRates = asObject({
  documents: asMap(asRatesDocument),
  results: asArray(asReturnRateUserResponse)
})

export const asZeroRateCurrencyCodes = asMap(asBoolean)

export const asProviderConfig = asObject({
  url: asString,
  apiKey: asOptional(asString)
})

export const asServerConfig = asObject({
  dbFullpath: asString,
  httpHost: asOptional(asString),
  httpPort: asOptional(asNumber),
  exchangesBatchLimit: asNumber,
  bridgeCurrencies: asArray(asString),
  cryptoCurrencyCodes: asArray(asString),
  zeroRateCurrencyCodes: asZeroRateCurrencyCodes,
  fallbackConstantRatePairs: asMap(asString),
  fiatCurrencyCodes: asArray(asString),
  ratesServerAddress: asString,
  currencyConverter: asProviderConfig,
  coinMarketCapLatest: asProviderConfig,
  coinMarketCapHistorical: asProviderConfig,
  coincapHistorical: asProviderConfig,
  slackWebhookUrl: asString,
  ratesLookbackLimit: asNumber
})

export const asExchangeRateReq = asObject({
  currency_pair: asString,
  date: asOptional(asString)
})

export const asExchangeRatesReq = asArray(asRateParams)

export const asRatesParams = (
  params: any,
  batchLimit = config.exchangesBatchLimit
): RateParams[] => {
  const results = asExchangeRatesReq(params)
  if (results.length > batchLimit) {
    throw new Error(`Exceeded Limit of ${batchLimit}`)
  }
  return results
}
