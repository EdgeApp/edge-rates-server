import express from 'express'
import { Document, IdentifiedDocument } from 'nano'

import {
  asCurrencyRates,
  asDbConfig,
  asExchangeRateReq,
  asHttpConfig,
  asProviderConfig,
  asRateError,
  asRateResponse,
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
export interface ServerState<D = {}> {
  [id: string]: ServerDocument<D>
}

export interface Request extends express.Request {
  params: any
  state?: ServerState
}

export interface Response extends express.Response {
  state: ServerState
  result: any
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
export type ProcessorResult<T> = T | { error: any } | undefined

export interface ProcessorResponse<T, D = {}, E = ServerError> {
  error?: E
  state?: ServerState<D>
  result?: ProcessorResult<T> | Array<ProcessorResult<T>>
}

export type Processor<T, D, R, E = any> = (
  params: T,
  state: ServerState<D> | {}
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
  documents: ServerState<D>
) => void

export type DbLoadFunction = <D>(
  settings: DbUtilSetting,
  documents: ServerState<D>
) => Promise<ServerState<D>>

// ///////////////////////////////////////////////// //
// ////////////// Other Utility Types ////////////// //
// ///////////////////////////////////////////////// //
export interface SlackerSettings {
  slackWebhookUrl: string
  lastText?: string
  lastDate?: number
}

// ///////////////////////////////////////////////// //
// //////////////// Providers Types //////////////// //
// ///////////////////////////////////////////////// //
export type ProviderConfig = ReturnType<typeof asProviderConfig>

export type RateProvider = (rateParams: RateParams) => Promise<string | null>
export interface RateProviders {
  provider: RateProvider
  providers: RateProvider[]
}

// //////////////////////////////////////////////////////////// //
// ////////////// Exchange Rate Processors Types ////////////// //
// //////////////////////////////////////////////////////////// //
export type RateRequest = ReturnType<typeof asExchangeRateReq>
export type RateResponse = ReturnType<typeof asRateResponse>
export type RateOptions = Partial<ServerConfig & RateProviders>
export interface RateParams {
  currencyA: string
  currencyB: string
  currencyPair: string
  date: string
}
export type CurrencyRates = ReturnType<typeof asCurrencyRates>
export type RatesState = ServerDocument<CurrencyRates>
export type RateError = ReturnType<typeof asRateError>

export type RateProcessor = Processor<
  RateParams,
  CurrencyRates,
  RateResponse,
  RateError
>

export type RateProcessorResponse = ProcessorResponse<
  RateResponse,
  CurrencyRates,
  RateError
>

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
