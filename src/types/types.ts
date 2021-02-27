import express from 'express'
import { Document, IdentifiedDocument } from 'nano'

import {
  asCurrencyRates,
  asDbConfig,
  asHttpConfig,
  asProviderConfig,
  asRateGetterError,
  asRateGetterResponse,
  asRateGetterResult,
  asServerConfig,
  asServerError,
  ERRORS
} from './cleaners'

// ////////////////////////////////////////// //
// ////////////// Helper Types ////////////// //
// ////////////////////////////////////////// //
export type OmitFirstArg<F> = F extends (x: any, ...args: infer P) => infer R
  ? (...args: P) => R
  : never

// ////////////////////////////////////////// //
// ////////////// Server Types ////////////// //
// ////////////////////////////////////////// //
export type ErrorType = typeof ERRORS[number]
export type ServerConfig = ReturnType<typeof asServerConfig>
export type HttpConfig = ReturnType<typeof asHttpConfig>
export type ServerError = ReturnType<typeof asServerError>
export type ServerDocument<D = {}> = D & (Document | IdentifiedDocument)

export interface Request extends express.Request {
  params: any
  documents?: { [id: string]: ServerDocument }
}

export interface Response extends express.Response {
  documents: { [_id: string]: ServerDocument }
  results: any
}

export type Middleware = (
  req: Request,
  res: Response,
  next: express.NextFunction
) => Promise<void> | void

export type ErrorMiddleware = (
  err: ServerError,
  req: Request,
  res: Response,
  next: express.NextFunction
) => Promise<void> | void

// ///////////////////////////////////////////////////// //
// ////////////// Processor Utility Types ////////////// //
// ///////////////////////////////////////////////////// //
export interface State<D = {}> {
  [_id: string]: ServerDocument<D>
}

export type ProcessorResult<T> = T | { error: any } | undefined

export interface ProcessorResponse<T, D = {}, E = ServerError> {
  error?: E
  documents?: State<D>
  result?: ProcessorResult<T> | Array<ProcessorResult<T>>
}

export type Processor<T, D, R, E = any> = (
  params: T,
  state: State<D> | {}
) => ProcessorResponse<R, D, E> | Promise<ProcessorResponse<R, D, E>>

// ////////////////////////////////////////////// //
// ////////////// DB Utility Types ////////////// //
// ////////////////////////////////////////////// //
export interface InitState<D = {}> {
  [_id: string]: ServerDocument<D> | {}
}
export type DbConfig = ReturnType<typeof asDbConfig>

export interface DbUtilSetting {
  localDB: any
  log?: (...args: any) => void
  locks?: { [lockId: string]: any }
}

export type DbSaveFunction = <D>(
  settings: DbUtilSetting,
  documents: State<D>
) => void

export type DbLoadFunction = <D>(
  settings: DbUtilSetting,
  documents: { [_id: string]: ServerDocument<D> | {} }
) => Promise<State<D>>

// ///////////////////////////////////////////////// //
// ////////////// Other Utility Types ////////////// //
// ///////////////////////////////////////////////// //
export interface SlackerSettings {
  slackWebhookUrl: string
  lastText?: string
  lastDate?: number
}

// //////////////////////////////////////////////////////////// //
// ////////////// Exchange Rate Processors Types ////////////// //
// //////////////////////////////////////////////////////////// //
export type CurrencyRates = ReturnType<typeof asCurrencyRates>
export type RateGetterOptions = Partial<ServerConfig & Exchanges>
export type RateGetterError = ReturnType<typeof asRateGetterError>
export type RatesGetterDocument = ServerDocument<CurrencyRates>
export type RateGetterResponse = Partial<
  ReturnType<typeof asRateGetterResponse>
>

export interface RateGetterParams {
  currencyA: string
  currencyB: string
  currencyPair: string
  date: string
}

export type RateGetter = (
  options: RateGetterOptions,
  rateParams: RateGetterParams,
  document?: RatesGetterDocument
) => RateGetterResponse | Promise<RateGetterResponse>

export type RateGetterResult = ReturnType<typeof asRateGetterResult>

export type RateProcessor = Processor<
  RateGetterParams,
  RatesGetterDocument,
  RateGetterResult,
  RateGetterError
>

export type RatesProcessorState = State<RatesGetterDocument>

export type RateProcessorResponse = ProcessorResponse<
  RateGetterResult,
  RatesGetterDocument,
  RateGetterError
>

// ///////////////////////////////////////////////// //
// //////////////// Providers Types //////////////// //
// ///////////////////////////////////////////////// //
export type ProviderConfig = ReturnType<typeof asProviderConfig>

export type ProviderFetch = (
  rateParams: RateGetterParams
) => Promise<string | null>

export interface Exchanges {
  exchanges: ProviderFetch[]
}

// //////////////////////////////////////////////////////////// //
// ////////////// Rate Processors settings Types ////////////// //
// //////////////////////////////////////////////////////////// //
export type ExchangesBatchLimit = Pick<ServerConfig, 'exchangesBatchLimit'>
export type RatesLookbackLimit = Pick<ServerConfig, 'ratesLookbackLimit'>
export type BridgeCurrencies = Pick<ServerConfig, 'bridgeCurrencies'>
export type ZeroRateCurrencyCodes = Pick<ServerConfig, 'zeroRateCurrencyCodes'>
export type FallbackConstantRatePairs = Pick<
  ServerConfig,
  'fallbackConstantRatePairs'
>
