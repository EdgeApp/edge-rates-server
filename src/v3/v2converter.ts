import type { ReturnRate } from '../rates'
import { ONE_MINUTE } from './constants'
import type {
  EdgeAsset,
  GetRatesParams,
  IncomingGetRatesParams,
  V2CurrencyCodeMap
} from './types'

interface V2Request {
  currency_pair: string
  date?: string
}

interface ParsedPair {
  from: string
  to: string
  isFiatFrom: boolean
  isFiatTo: boolean
  date?: Date
}

/**
 * Parse a V2 currency pair like "BTC_iso:USD" or "iso:EUR_ETH"
 */
const parseCurrencyPair = (currencyPair: string, date?: string): ParsedPair => {
  const parts = currencyPair.split('_')
  if (parts.length !== 2) {
    throw new Error(`Invalid currency pair format: ${currencyPair}`)
  }

  const [from, to] = parts
  const isFiatFrom = from.startsWith('iso:')
  const isFiatTo = to.startsWith('iso:')

  return {
    from: isFiatFrom ? from.slice(4) : from,
    to: isFiatTo ? to.slice(4) : to,
    isFiatFrom,
    isFiatTo,
    date: date != null ? new Date(date) : undefined
  }
}

/**
 * Convert a currency code to an EdgeAsset using the currency code map
 * If not found in the map, uses the uppercase currency code as pluginId with null tokenId
 */
const currencyCodeToAsset = (
  currencyCode: string,
  currencyCodeMaps: V2CurrencyCodeMap
): EdgeAsset => {
  const mapping = currencyCodeMaps[currencyCode]
  if (mapping == null) {
    // Fallback: use uppercase currency code as pluginId
    // This will likely result in an error in the V3 API response for this asset
    return {
      pluginId: currencyCode.toUpperCase(),
      tokenId: null
    }
  }

  return {
    pluginId: mapping.pluginId,
    tokenId: mapping.tokenId
  }
}

export const convertV2 = (
  v2Requests: V2Request[],
  currencyCodeMaps: V2CurrencyCodeMap
): IncomingGetRatesParams => {
  // Get the time rounded down to the nearest minute
  const roundedNow = new Date(
    Math.floor(new Date().getTime() / ONE_MINUTE) * ONE_MINUTE
  )

  // Parse all V2 requests
  const parsedPairs = v2Requests.map(req =>
    parseCurrencyPair(req.currency_pair, req.date)
  )

  // Group requests by their requirements
  // Since V3 requires targetFiat to be "USD", we need to organize our requests accordingly
  const cryptoAssetsMap = new Map<
    string,
    { asset: EdgeAsset; isoDate: Date | undefined; rate: number | undefined }
  >()
  const fiatCodesMap = new Map<
    string,
    { fiatCode: string; isoDate: Date | undefined; rate: number | undefined }
  >()

  for (const parsed of parsedPairs) {
    // Fill all blank dates with the current time rounded down.
    // This is so we can match v3 returned values with the requested dates
    parsed.date ??= roundedNow

    // Case 1: crypto_fiat (e.g., "BTC_iso:USD")
    if (!parsed.isFiatFrom && parsed.isFiatTo) {
      // Add crypto asset
      const asset = currencyCodeToAsset(parsed.from, currencyCodeMaps)
      // Include date in key to support multiple requests for same asset at different times
      const key = `${asset.pluginId}_${
        asset.tokenId ?? 'null'
      }_${parsed.date.toISOString()}`
      if (!cryptoAssetsMap.has(key)) {
        cryptoAssetsMap.set(key, {
          asset,
          isoDate: parsed.date,
          rate: undefined
        })
      }

      // If the target fiat is not USD, we need to add it to the fiat array
      if (parsed.to !== 'USD') {
        const fiatKey = `${parsed.to}_${parsed.date.toISOString()}`
        if (!fiatCodesMap.has(fiatKey)) {
          fiatCodesMap.set(fiatKey, {
            fiatCode: parsed.to,
            isoDate: parsed.date,
            rate: undefined
          })
        }
      }
    }
    // Case 2: fiat_crypto (e.g., "iso:USD_ETH")
    // This means we want to know how much ETH costs 1 USD, which is 1/ETH_USD
    // So we request ETH in USD
    else if (parsed.isFiatFrom && !parsed.isFiatTo) {
      // Add crypto asset
      const asset = currencyCodeToAsset(parsed.to, currencyCodeMaps)
      // Include date in key to support multiple requests for same asset at different times
      const key = `${asset.pluginId}_${
        asset.tokenId ?? 'null'
      }_${parsed.date.toISOString()}`
      if (!cryptoAssetsMap.has(key)) {
        cryptoAssetsMap.set(key, {
          asset,
          isoDate: parsed.date,
          rate: undefined
        })
      }

      // If the source fiat is not USD, we need to add it to the fiat array
      if (parsed.from !== 'USD') {
        const fiatKey = `${parsed.from}_${parsed.date.toISOString()}`
        if (!fiatCodesMap.has(fiatKey)) {
          fiatCodesMap.set(fiatKey, {
            fiatCode: parsed.from,
            isoDate: parsed.date,
            rate: undefined
          })
        }
      }
    }
    // Case 3: crypto_crypto (e.g., "BTC_ETH")
    // We need both crypto assets priced in USD
    else if (!parsed.isFiatFrom && !parsed.isFiatTo) {
      const fromAsset = currencyCodeToAsset(parsed.from, currencyCodeMaps)
      // Include date in key to support multiple requests for same asset at different times
      const fromKey = `${fromAsset.pluginId}_${
        fromAsset.tokenId ?? 'null'
      }_${parsed.date.toISOString()}`
      if (!cryptoAssetsMap.has(fromKey)) {
        cryptoAssetsMap.set(fromKey, {
          asset: fromAsset,
          isoDate: parsed.date,
          rate: undefined
        })
      }

      const toAsset = currencyCodeToAsset(parsed.to, currencyCodeMaps)
      const toKey = `${toAsset.pluginId}_${
        toAsset.tokenId ?? 'null'
      }_${parsed.date.toISOString()}`
      if (!cryptoAssetsMap.has(toKey)) {
        cryptoAssetsMap.set(toKey, {
          asset: toAsset,
          isoDate: parsed.date,
          rate: undefined
        })
      }
    }
    // Case 4: fiat_fiat (e.g., "iso:EUR_iso:USD")
    // We need both fiat currencies
    else if (parsed.isFiatFrom && parsed.isFiatTo) {
      if (parsed.from !== 'USD') {
        const fiatKeyFrom = `${parsed.from}_${parsed.date.toISOString()}`
        if (!fiatCodesMap.has(fiatKeyFrom)) {
          fiatCodesMap.set(fiatKeyFrom, {
            fiatCode: parsed.from,
            isoDate: parsed.date,
            rate: undefined
          })
        }
      }
      if (parsed.to !== 'USD') {
        const fiatKeyTo = `${parsed.to}_${parsed.date.toISOString()}`
        if (!fiatCodesMap.has(fiatKeyTo)) {
          fiatCodesMap.set(fiatKeyTo, {
            fiatCode: parsed.to,
            isoDate: parsed.date,
            rate: undefined
          })
        }
      }
    }
  }

  // Build the V3 request with targetFiat = "USD"
  return {
    targetFiat: 'USD',
    crypto: Array.from(cryptoAssetsMap.values()),
    fiat: Array.from(fiatCodesMap.values())
  }
}

/**
 * Convert V3 API response back to V2 format
 */
export const convertV3ToV2 = (
  v2Requests: V2Request[],
  v3Response: GetRatesParams,
  currencyCodeMaps: V2CurrencyCodeMap
): ReturnRate[] => {
  const results: ReturnRate[] = []

  // Helper to match dates - compares ISO date strings (or Date objects)
  const datesMatch = (
    date1: Date | undefined,
    date2: Date | undefined
  ): boolean => {
    if (date1 === undefined && date2 === undefined) return true
    if (date1 === undefined || date2 === undefined) return false
    const d1 = date1.toISOString()
    const d2 = date2.toISOString()
    return d1 === d2
  }

  // Helper to find crypto rate by currency code and date
  const findCryptoRate = (
    currencyCode: string,
    requestDate: Date | undefined
  ): number | undefined => {
    const asset = currencyCodeToAsset(currencyCode, currencyCodeMaps)
    const cryptoRate = v3Response.crypto.find(
      c =>
        c.asset.pluginId === asset.pluginId &&
        (c.asset.tokenId ?? null) === (asset.tokenId ?? null) &&
        datesMatch(requestDate, c.isoDate)
    )
    return cryptoRate?.rate
  }

  // Helper to find fiat rate by fiat code and date
  const findFiatRate = (
    fiatCode: string,
    requestDate: Date | undefined
  ): number | undefined => {
    if (fiatCode === 'USD') {
      return 1 // USD is the base, rate is always 1
    }
    const fiatRate = v3Response.fiat.find(
      f => f.fiatCode === fiatCode && datesMatch(requestDate, f.isoDate)
    )

    return fiatRate?.rate
  }

  for (const v2Request of v2Requests) {
    const parsed = parseCurrencyPair(v2Request.currency_pair, v2Request.date)
    const date = parsed.date?.toISOString() ?? new Date().toISOString()

    let exchangeRate: string | null = null
    let error: string | undefined

    try {
      // Case 1: crypto_fiat (e.g., "BTC_iso:USD")
      if (!parsed.isFiatFrom && parsed.isFiatTo) {
        const cryptoRate = findCryptoRate(parsed.from, parsed.date)
        const fiatRate = findFiatRate(parsed.to, parsed.date)

        if (cryptoRate === undefined) {
          error = `No rate found for ${parsed.from}`
        } else if (fiatRate === undefined) {
          error = `No rate found for ${parsed.to}`
        } else {
          // cryptoRate is in USD, fiatRate is fiat/USD
          // To get crypto in target fiat: cryptoRate * fiatRate
          exchangeRate = String(cryptoRate / fiatRate)
        }
      }
      // Case 2: fiat_crypto (e.g., "iso:USD_ETH")
      // How much crypto per 1 unit of fiat
      else if (parsed.isFiatFrom && !parsed.isFiatTo) {
        const cryptoRate = findCryptoRate(parsed.to, parsed.date)
        const fiatRate = findFiatRate(parsed.from, parsed.date)

        if (cryptoRate === undefined) {
          error = `No rate found for ${parsed.to}`
        } else if (fiatRate === undefined) {
          error = `No rate found for ${parsed.from}`
        } else {
          // fiatRate is fiat/USD, cryptoRate is USD/crypto
          // So fiat/crypto = fiatRate / cryptoRate
          exchangeRate = String(fiatRate / cryptoRate)
        }
      }
      // Case 3: crypto_crypto (e.g., "BTC_ETH")
      else if (!parsed.isFiatFrom && !parsed.isFiatTo) {
        const fromRate = findCryptoRate(parsed.from, parsed.date)
        const toRate = findCryptoRate(parsed.to, parsed.date)

        if (fromRate === undefined) {
          error = `No rate found for ${parsed.from}`
        } else if (toRate === undefined) {
          error = `No rate found for ${parsed.to}`
        } else {
          // Both are in USD, so from/to gives us the rate
          exchangeRate = String(fromRate / toRate)
        }
      }
      // Case 4: fiat_fiat (e.g., "iso:EUR_iso:USD")
      else if (parsed.isFiatFrom && parsed.isFiatTo) {
        const fromRate = findFiatRate(parsed.from, parsed.date)
        const toRate = findFiatRate(parsed.to, parsed.date)

        if (fromRate === undefined) {
          error = `No rate found for ${parsed.from}`
        } else if (toRate === undefined) {
          error = `No rate found for ${parsed.to}`
        } else {
          // Both are relative to USD, so from/to gives us the rate
          exchangeRate = String(fromRate / toRate)
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }

    results.push({
      currency_pair: v2Request.currency_pair,
      date,
      exchangeRate,
      error
    })
  }

  return results
}
