import { FIVE_MINUTES, ONE_MINUTE, TWENTY_FOUR_HOURS } from './constants'
import {
  CryptoRateMap,
  DateBuckets,
  EdgeAsset,
  EdgeCurrencyPluginId,
  EdgeTokenId,
  FiatRateMap,
  RateBuckets,
  TokenMap
} from './types'

export const toCryptoKey = (asset: EdgeAsset): string => {
  let tokenIdString = ''
  if (asset.tokenId != null) {
    tokenIdString = `_${asset.tokenId}`
  }
  return `${asset.pluginId}${tokenIdString}`
}
export const fromCryptoKey = (key: string): EdgeAsset => {
  const [pluginId, tokenId] = key.split('_') as [string, string?]
  return { pluginId, tokenId }
}

function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`)
}

// Create a tokenId from a contract address and currency code.
export const createTokenId = (
  pluginId: EdgeCurrencyPluginId,
  currencyCode: string,
  contractAddress?: string
): EdgeTokenId => {
  switch (pluginId) {
    // No token support:
    case 'binance':
    case 'bitcoin':
    case 'bitcoincash':
    case 'bitcoingold':
    case 'bitcoinsv':
    case 'cardano':
    case 'dash':
    case 'digibyte':
    case 'dogecoin':
    case 'eboost':
    case 'ecash':
    case 'eos':
    case 'feathercoin':
    case 'filecoin':
    case 'fio':
    case 'groestlcoin':
    case 'hedera':
    case 'litecoin':
    case 'monero':
    case 'piratechain':
    case 'pivx':
    case 'polkadot':
    case 'qtum':
    case 'ravencoin':
    case 'smartcash':
    case 'stellar':
    case 'telos':
    case 'tezos':
    case 'ton':
    case 'ufo':
    case 'vertcoin':
    case 'wax':
    case 'zcash':
    case 'zcoin': {
      if (contractAddress != null) {
        // these chains don't support tokens
        throw new Error('Tokens are not supported for this chain')
      }
      return null
    }

    // EVM token support:
    case 'arbitrum':
    case 'avalanche':
    case 'base':
    case 'binancesmartchain':
    case 'bobevm':
    case 'celo':
    case 'ethereum':
    case 'ethereumclassic':
    case 'ethereumpow':
    case 'fantom':
    case 'filecoinfevm':
    case 'hyperevm':
    case 'optimism':
    case 'polygon':
    case 'pulsechain':
    case 'rsk':
    case 'sonic':
    case 'zksync': {
      if (contractAddress != null) {
        return contractAddress.toLowerCase().replace(/^0x/, '')
      }
      return null
    }

    // Algorand token support:
    case 'algorand': {
      if (contractAddress != null) {
        return contractAddress
      }
      return null
    }

    // Cosmos token support:
    case 'axelar':
    case 'coreum':
    case 'cosmoshub':
    case 'osmosis':
    case 'thorchainrune': {
      if (contractAddress != null) {
        // Regexes inspired by a general regex in https://github.com/cosmos/cosmos-sdk
        // Broken up to more tightly enforce the rules for each type of asset so the entered value matches what a node would expect
        const ibcDenomRegex = /^ibc\/[0-9A-F]{64}$/
        const nativeDenomRegex = /^(?!ibc)[a-z][a-z0-9/]{2,127}/

        if (
          contractAddress == null ||
          (!ibcDenomRegex.test(contractAddress) &&
            !nativeDenomRegex.test(contractAddress))
        ) {
          throw new Error('Invalid contract address')
        }

        return contractAddress.toLowerCase().replace(/\//g, '')
      }
      return null
    }

    // Substrate token support:
    case 'liberland': {
      if (contractAddress != null) {
        return contractAddress
      }
      return null
    }

    // XRP token support:
    case 'ripple': {
      if (contractAddress != null) {
        let currency: string
        if (currencyCode.length > 3) {
          const hexCode = Buffer.from(currencyCode, 'utf8').toString('hex')
          currency = hexCode.toUpperCase().padEnd(40, '0')
        } else {
          currency = currencyCode
        }

        return `${currency}-${contractAddress}`
      }
      return null
    }

    // Solana token support:
    case 'solana': {
      if (contractAddress != null) {
        return contractAddress
      }
      return null
    }

    // Sui token support:
    case 'sui': {
      if (contractAddress != null) {
        return contractAddress.replace(/:/g, '')
      }
      return null
    }

    // Tron token support:
    case 'tron': {
      if (contractAddress != null) {
        return contractAddress
      }
      return null
    }

    // Zano token support:
    case 'zano': {
      if (contractAddress != null) {
        return contractAddress.toLowerCase()
      }
      return null
    }

    // Make sure we handle all cases:
    default: {
      return assertNever(pluginId)
    }
  }
}

// These functions reduce requested rates into buckets based on the date that
// the providers can handle efficiently. The rates returned by the providers
// can then be rematched with the requested rates
export const reduceRequestedCryptoRates = (
  requestedRates: CryptoRateMap,
  rightNow: Date,
  mapping?: TokenMap
): DateBuckets => {
  const buckets: DateBuckets = new Map()

  requestedRates.forEach(rate => {
    const rateTime = rate.isoDate.getTime()

    // Current rates (< five minutes old) use minute precision and historical rates use five minutes
    const intervalMs =
      rightNow.getTime() - rateTime < FIVE_MINUTES ? ONE_MINUTE : FIVE_MINUTES

    // Floor to the start of the interval bucket
    const bucketTime = Math.floor(rateTime / intervalMs) * intervalMs
    const bucketKey = new Date(bucketTime).toISOString()
    const bucket = buckets.get(bucketKey) ?? new Set()

    let id: string | undefined
    if (mapping == null) {
      id = toCryptoKey(rate.asset)
    } else {
      id = mapping[toCryptoKey(rate.asset)]?.id
    }

    if (id != null) {
      bucket.add(id)
      buckets.set(bucketKey, bucket)
    }
  })

  return buckets
}

export const expandReturnedCryptoRates = (
  requestedRates: CryptoRateMap,
  rightNow: Date,
  returnedRates: RateBuckets,
  mapping?: TokenMap
): { foundRates: CryptoRateMap; requestedRates: CryptoRateMap } => {
  const foundRates: CryptoRateMap = new Map()
  const missingRates: CryptoRateMap = new Map()

  requestedRates.forEach((rate, key) => {
    const rateTime = rate.isoDate.getTime()

    // Current rates (< five minutes old) use minute precision and historical rates use five minutes
    const intervalMs =
      rightNow.getTime() - rateTime < FIVE_MINUTES ? ONE_MINUTE : FIVE_MINUTES

    // Floor to the start of the interval bucket
    const bucketTime = Math.floor(rateTime / intervalMs) * intervalMs
    const bucketKey = new Date(bucketTime).toISOString()
    const bucket = returnedRates.get(bucketKey) ?? {}

    let id: string | undefined
    if (mapping == null) {
      id = toCryptoKey(rate.asset)
    } else {
      id = mapping[toCryptoKey(rate.asset)]?.id
    }

    if (id == null) {
      missingRates.set(key, rate)
      return
    }

    const exchangeRate: number | undefined = bucket[id]
    if (exchangeRate != null) {
      foundRates.set(key, { ...rate, rate: exchangeRate })
    } else {
      missingRates.set(key, rate)
    }
  })

  return { foundRates, requestedRates: missingRates }
}

export const reduceRequestedFiatRates = (
  requestedRates: FiatRateMap
): DateBuckets => {
  const buckets: DateBuckets = new Map()

  requestedRates.forEach(rate => {
    const rateTime = rate.isoDate.getTime()

    // Floor to the start of the interval bucket
    const bucketTime =
      Math.floor(rateTime / TWENTY_FOUR_HOURS) * TWENTY_FOUR_HOURS
    const bucketKey = new Date(bucketTime).toISOString()
    const bucket = buckets.get(bucketKey) ?? new Set()

    bucket.add(rate.fiatCode)
    buckets.set(bucketKey, bucket)
  })

  return buckets
}

export const expandReturnedFiatRates = (
  requestedRates: FiatRateMap,
  returnedRates: RateBuckets
): { foundRates: FiatRateMap; requestedRates: FiatRateMap } => {
  const foundRates: FiatRateMap = new Map()
  const missingRates: FiatRateMap = new Map()

  requestedRates.forEach((rate, key) => {
    const rateTime = rate.isoDate.getTime()

    // Floor to the start of the interval bucket
    const bucketTime =
      Math.floor(rateTime / TWENTY_FOUR_HOURS) * TWENTY_FOUR_HOURS
    const bucketKey = new Date(bucketTime).toISOString()
    const bucket = returnedRates.get(bucketKey) ?? {}

    const exchangeRate: number | undefined = bucket[rate.fiatCode]
    if (exchangeRate != null) {
      foundRates.set(key, { ...rate, rate: exchangeRate })
    } else {
      missingRates.set(key, rate)
    }
  })

  return { foundRates, requestedRates: missingRates }
}

// This function breaks apart the requested rates into buckets of the given interval.
type UpdateBuckets = Map<string, { [id: string]: number }>
export const groupCryptoRatesByTime = (
  requestedRates: CryptoRateMap
): UpdateBuckets => {
  const buckets: UpdateBuckets = new Map()
  const rightNowMs = new Date().getTime()

  requestedRates.forEach(cryptoRate => {
    if (cryptoRate.rate == null) return

    const rateTime = cryptoRate.isoDate.getTime()

    // Current rates (< five minutes old) use minute precision and historical rates use five minutes
    const intervalMs =
      rightNowMs - rateTime < FIVE_MINUTES ? ONE_MINUTE : FIVE_MINUTES

    // Floor to the start of the interval bucket
    const bucketTime = Math.floor(rateTime / intervalMs) * intervalMs
    const bucketKey = new Date(bucketTime).toISOString()
    const bucket = buckets.get(bucketKey) ?? {}
    bucket[toCryptoKey(cryptoRate.asset)] = cryptoRate.rate
    buckets.set(bucketKey, bucket)
  })

  return buckets
}

export const groupFiatRatesByTime = (
  requestedRates: FiatRateMap
): UpdateBuckets => {
  const buckets: UpdateBuckets = new Map()

  requestedRates.forEach(fiatRate => {
    if (fiatRate.rate == null) return

    const rateTime = fiatRate.isoDate.getTime()

    // Floor to the start of the interval bucket
    const bucketTime =
      Math.floor(rateTime / TWENTY_FOUR_HOURS) * TWENTY_FOUR_HOURS
    const bucketKey = new Date(bucketTime).toISOString()
    const bucket = buckets.get(bucketKey) ?? {}
    bucket[fiatRate.fiatCode] = fiatRate.rate
    buckets.set(bucketKey, bucket)
  })

  return buckets
}

// This helps providers determine which endpoint to use for the date requested.
// For providers that only look up current rates, they would use this to ignore
// historical requests.
export const isCurrent = (
  isoDate: Date,
  rightNow: Date,
  intervalMs: number = ONE_MINUTE
): boolean => {
  const requestedDate = isoDate.getTime()
  const rightNowMs = rightNow.getTime()
  if (requestedDate > rightNowMs || requestedDate + intervalMs < rightNowMs) {
    return false
  }
  return true
}
export const isCurrentFiat = (isoDate: Date, rightNow: Date): boolean =>
  isCurrent(isoDate, rightNow, TWENTY_FOUR_HOURS)
