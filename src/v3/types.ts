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
export type EdgeTokenId = ReturnType<typeof asEdgeTokenId>

const asEdgeAsset = asObject({
  pluginId: asString,
  tokenId: asEdgeTokenId
})

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
type GetRatesParams = ReturnType<typeof asGetRatesParams>

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

export interface RateProvider {
  providerId: string
  type: 'memory' | 'db' | 'api'
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
    frequency: 'minute' | 'hour' | 'day' | 'week' | 'month'
    engine: RateEngine
  }>
}

export type GetRatesFunc = (params: GetRatesParams) => Promise<GetRatesParams>

export interface TokenMap {
  [key: string]: {
    id: string
    slug: string
  }
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
