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

import { normalizeDate } from '../utils/utils'
import { RateParams, RatesState } from './types'

export const DEFAULT_CONFIG = {
  dbFullpath: 'http://admin:password@localhost:5984',
  dbName: 'db_rates',
  httpHost: '127.0.0.1',
  slackWebhookUrl: '',
  ratesServerAddress: 'http://localhost:8008',
  httpPort: 8008,
  exchangesBatchLimit: 100,
  ratesLookbackLimit: 604800000,
  apiKey: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
  bridgeCurrencies: ['USD', 'BTC']
}
export const ERRORS = [
  'not_found',
  'conflict',
  'db_error',
  'bad_query',
  'server_error'
]
// ////////////////////////////////////////////// //
// ////////////// Utility Cleaners ////////////// //
// ////////////////////////////////////////////// //
export const asMaybeString = asOptional(asString, null)
export const asDefaultOptional = <T>(cleaner: Cleaner<T>) => (
  def: T
): Cleaner<T> => asOptional(cleaner, def)

export const asOptString = asDefaultOptional(asString)
export const asOptNumber = asDefaultOptional(asNumber)
export const asObjectMap = <T>(
  obj: ObjectShape<T>
): Cleaner<{ [key: string]: T }> => asMap(asObject(obj))

export const asMapWithProps = <T, G>(
  map: Cleaner<T>,
  props: ObjectShape<G>
) => obj => ({ ...asMap(map)(obj), ...asObject(props)(obj) })

// ////////////////////////////////////////////// //
// /////////////// Server Cleaners ////////////// //
// ////////////////////////////////////////////// //
export const asErrorType = (errorType: any): string => {
  const str = asString(errorType)
  if (!ERRORS.includes(str)) {
    throw new Error('Unknown error type')
  }
  return str
}

export const asServerError = asObject({
  message: asString,
  errorCode: asNumber,
  errorType: asErrorType
})

// //////////////////////////////////////////////////////////// //
// //////////// Exchange Rate Processors Cleaners ///////////// //
// //////////////////////////////////////////////////////////// //
export const asExchangeRateReq = asObject({
  currency_pair: asString,
  date: asOptional(asString)
})
export const asExchangeRatesReq = asArray(asExchangeRateReq)

export const asRateResponse = asObject({
  date: asString,
  currency_pair: asString,
  exchangeRate: asString
})

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

export const asRatesParams = (
  params: any,
  batchLimit = DEFAULT_CONFIG.exchangesBatchLimit
): RateParams[] => {
  const results = asArray(asRateParams)(params)
  if (results.length > batchLimit) {
    throw new Error(`Exceeded Limit of ${batchLimit}`)
  }
  return results
}

export const asCurrencyRates = asMap(asString)
export const asRatesState = asMapWithProps(asString, { _id: asString })

export const asRateError = asObject({
  ...asRateParams,
  ...asServerError.shape
})

export const asRateGetterResponse = asObject({
  rate: asOptional(asString),
  document: asOptional(asRatesState),
  error: asOptional(asRateError)
})

export const asRateDocument = ({
  date
}: RateParams): Cleaner<RatesState> => docs =>
  docs[date] != null ? asRatesState(docs[date]) : { _id: date }

// //////////////////////////////////////////////////// //
// ////////////// Configuration Cleaners ////////////// //
// //////////////////////////////////////////////////// //
export const asProviderConfig = asObject({
  url: asString,
  apiKey: asOptString(DEFAULT_CONFIG.apiKey)
})

export const asDbConfig = asObject({
  dbFullpath: asOptString(DEFAULT_CONFIG.dbFullpath),
  dbName: asOptString(DEFAULT_CONFIG.dbName)
})

export const asHttpConfig = asObject({
  httpHost: asOptString(DEFAULT_CONFIG.httpHost),
  httpPort: asOptNumber(DEFAULT_CONFIG.httpPort),
  slackWebhookUrl: asOptString(DEFAULT_CONFIG.slackWebhookUrl)
})

export const asRateEngine = asObject({
  cryptoCurrencyCodes: asArray(asString),
  fiatCurrencyCodes: asArray(asString),
  ratesServerAddress: asOptString(DEFAULT_CONFIG.ratesServerAddress)
})

export const asProvidersSettings = asObject({
  currencyConverter: asProviderConfig,
  coinMarketCapLatest: asProviderConfig,
  coinMarketCapHistorical: asProviderConfig,
  coincapHistorical: asProviderConfig
})

export const asExchangeRateSettings = asObject({
  exchangesBatchLimit: asOptNumber(DEFAULT_CONFIG.exchangesBatchLimit),
  ratesLookbackLimit: asOptNumber(DEFAULT_CONFIG.ratesLookbackLimit),
  bridgeCurrencies: asOptional(
    asArray(asString),
    DEFAULT_CONFIG.bridgeCurrencies
  ),
  zeroRateCurrencyCodes: asMap(asBoolean),
  fallbackConstantRatePairs: asMap(asString)
})

export const asServerConfig = asObject({
  ...asDbConfig.shape,
  ...asHttpConfig.shape,
  ...asRateEngine.shape,
  ...asProvidersSettings.shape,
  ...asExchangeRateSettings.shape
})
