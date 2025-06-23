import {
  asArray,
  asDate,
  asEither,
  asNull,
  asNumber,
  asObject,
  asOptional,
  asString
} from 'cleaners'

const asEdgeTokenId = asEither(asString, asNull)
const asEdgeAsset = asObject({
  pluginId: asString,
  tokenId: asEdgeTokenId
})

const asCryptoRate = asObject({
  isoDate: asDate,
  asset: asEdgeAsset,
  rate: asOptional(asNumber) // Return undefined if unable to get rate
})

const asFiatRate = asObject({
  fiatCode: asString,
  rate: asOptional(asNumber) // Return undefined if unable to get rate
})

export const asGetRatesParams = asObject({
  targetFiat: asString,
  crypto: asArray(asCryptoRate),
  fiat: asArray(asFiatRate)
})

export type EdgeTokenId = ReturnType<typeof asEdgeTokenId>
export type EdgeAsset = ReturnType<typeof asEdgeAsset>
export type CryptoRate = ReturnType<typeof asCryptoRate>
export type FiatRate = ReturnType<typeof asFiatRate>
export type GetRatesParams = ReturnType<typeof asGetRatesParams>

export interface GetCryptoRatesParams {
  targetFiat: string
  rates: CryptoRate[]
}
export interface GetFiatRatesParams {
  targetFiat: string
  rates: FiatRate[]
}

export interface GetRatesFuncReturn {
  crypto: CryptoRate[]
  fiat: FiatRate[]
}
export type GetRatesFunc = (
  params: GetRatesParams
) => Promise<GetRatesFuncReturn>

export type RateEngine = () => void
export interface RateProvider {
  providerId: string
  type: 'memory' | 'db' | 'api'
  getCryptoRates?: (params: GetCryptoRatesParams) => Promise<CryptoRate[]>
  getFiatRates?: (params: GetFiatRatesParams) => Promise<FiatRate[]>
  updateRates?: (params: GetRatesParams) => Promise<void>
  engines?: Array<{
    frequency: 'hour' | 'day' | 'week' | 'month'
    engine: RateEngine
  }>
}
