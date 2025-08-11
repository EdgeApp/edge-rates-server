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
import { DatabaseSetup } from 'edge-server-tools'

const asEdgeTokenId = asEither(asString, asNull)
export type EdgeTokenId = ReturnType<typeof asEdgeTokenId>

export const asEdgeAsset = asObject({
  pluginId: asString,
  tokenId: asEdgeTokenId
})
export type EdgeAsset = ReturnType<typeof asEdgeAsset>

const asCryptoRate = asObject({
  isoDate: asDate,
  asset: asEdgeAsset,
  rate: asOptional(asNumber) // Return undefined if unable to get rate
})
export type CryptoRate = ReturnType<typeof asCryptoRate>

const asFiatRate = asObject({
  isoDate: asDate,
  fiatCode: asString,
  rate: asOptional(asNumber) // Return undefined if unable to get rate
})
export type FiatRate = ReturnType<typeof asFiatRate>

export const asGetRatesParams = asObject({
  targetFiat: asString,
  crypto: asArray(asCryptoRate),
  fiat: asArray(asFiatRate)
})
export type GetRatesParams = ReturnType<typeof asGetRatesParams>

export const asIncomingGetRatesParams = asObject({
  targetFiat: asString,
  crypto: asArray(
    asObject({
      isoDate: asOptional(asDate),
      asset: asEdgeAsset,
      rate: asOptional(asNumber)
    })
  ),
  fiat: asArray(
    asObject({
      isoDate: asOptional(asDate),
      fiatCode: asString,
      rate: asOptional(asNumber)
    })
  )
})
export type IncomingGetRatesParams = ReturnType<typeof asIncomingGetRatesParams>

export type CryptoRateMap = Map<string, CryptoRate>
export type FiatRateMap = Map<string, FiatRate>

interface GetCryptoRatesParams {
  targetFiat: string
  requestedRates: CryptoRateMap
}

interface GetFiatRatesParams {
  targetFiat: string
  requestedRates: FiatRateMap
}

export interface UpdateRatesParams {
  targetFiat: string
  crypto: CryptoRateMap
  fiat: FiatRateMap
}

export type RateEngine = () => Promise<void>

export type Frequency = 'minute' | 'hour' | 'day' | 'week' | 'month'

export interface RateProvider {
  providerId: string
  type: 'memory' | 'db' | 'api'
  documents?: DatabaseSetup[]
  getCryptoRates?: (params: GetCryptoRatesParams) => Promise<{
    foundRates: CryptoRateMap
    requestedRates: CryptoRateMap
  }>
  getFiatRates?: (params: GetFiatRatesParams) => Promise<{
    foundRates: FiatRateMap
    requestedRates: FiatRateMap
  }>
  updateRates?: (params: UpdateRatesParams) => Promise<void>
  engines?: Array<{
    frequency: Frequency
    engine: RateEngine
  }>
}

export type GetRatesFunc = (params: GetRatesParams) => Promise<GetRatesParams>

export const asTokenMap = asObject(
  asObject({
    id: asString,
    slug: asString
  })
)
export type TokenMap = ReturnType<typeof asTokenMap>

export interface StringMap {
  [key: string]: string
}

export type EdgeCurrencyPluginId =
  | 'algorand'
  | 'arbitrum'
  | 'avalanche'
  | 'axelar'
  | 'base'
  | 'binance'
  | 'binancesmartchain'
  | 'bitcoin'
  | 'bitcoincash'
  | 'bitcoingold'
  | 'bitcoinsv'
  | 'bobevm'
  | 'cardano'
  | 'celo'
  | 'coreum'
  | 'cosmoshub'
  | 'dash'
  | 'digibyte'
  | 'dogecoin'
  | 'eboost'
  | 'ecash'
  | 'eos'
  | 'ethereum'
  | 'ethereumclassic'
  | 'ethereumpow'
  | 'fantom'
  | 'feathercoin'
  | 'filecoin'
  | 'filecoinfevm'
  | 'fio'
  | 'groestlcoin'
  | 'hedera'
  | 'hyperevm'
  | 'liberland'
  | 'litecoin'
  | 'monero'
  | 'optimism'
  | 'osmosis'
  | 'piratechain'
  | 'pivx'
  | 'polkadot'
  | 'polygon'
  | 'pulsechain'
  | 'qtum'
  | 'ravencoin'
  | 'ripple'
  | 'rsk'
  | 'smartcash'
  | 'solana'
  | 'sonic'
  | 'stellar'
  | 'sui'
  | 'telos'
  | 'tezos'
  | 'thorchainrune'
  | 'ton'
  | 'tron'
  | 'ufo'
  | 'vertcoin'
  | 'wax'
  | 'zcash'
  | 'zcoin'
  | 'zano'
  | 'zksync'

export type EdgeCurrencyPluginIdUIDMap = Record<
  EdgeCurrencyPluginId,
  string | null
>

export interface NumberMap {
  [key: string]: number
}

export type RateBuckets = Map<string, NumberMap>

export type DateBuckets = Map<string, Set<string>>

export const asRateDocument = asObject({
  crypto: asObject(
    asObject({
      // currencyCode: asString,
      USD: asNumber
    })
  ),
  fiat: asObject(
    asObject({
      USD: asNumber
    })
  )
})
export type RateDocument = ReturnType<typeof asRateDocument>
