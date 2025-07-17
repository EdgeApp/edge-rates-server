import { CryptoRate, FiatRate } from './types'

export const toCryptoRateKey = (rate: CryptoRate): string => {
  return `${rate.isoDate.toISOString()}_${rate.asset.pluginId}_${String(
    rate.asset.tokenId
  )}`
}
export const toFiatRateKey = (rate: FiatRate): string => {
  return `${rate.isoDate.toISOString()}_${rate.fiatCode}`
}
