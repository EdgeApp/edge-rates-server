import type { ReturnRate } from '../rates'
import { ONE_MINUTE } from './constants'
import { toDatedCryptoKey, toDatedFiatKey } from './router'
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

  // Helper to add crypto asset
  const addCrypto = (currencyCode: string, date: Date): void => {
    const asset = currencyCodeToAsset(currencyCode, currencyCodeMaps)
    const key = toDatedCryptoKey({ asset, isoDate: date, rate: undefined })
    if (!cryptoAssetsMap.has(key)) {
      cryptoAssetsMap.set(key, { asset, isoDate: date, rate: undefined })
    }
  }

  // Helper to add fiat (skip USD)
  const addFiat = (fiatCode: string, date: Date): void => {
    if (fiatCode === 'USD') return
    const key = toDatedFiatKey({ fiatCode, isoDate: date, rate: undefined })
    if (!fiatCodesMap.has(key)) {
      fiatCodesMap.set(key, { fiatCode, isoDate: date, rate: undefined })
    }
  }

  for (const parsed of parsedPairs) {
    parsed.date ??= roundedNow

    if (parsed.isFiatFrom) {
      addFiat(parsed.from, parsed.date)
    } else {
      addCrypto(parsed.from, parsed.date)
    }
    if (parsed.isFiatTo) {
      addFiat(parsed.to, parsed.date)
    } else {
      addCrypto(parsed.to, parsed.date)
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
    const date = parsed.date?.toISOString()
    if (date == null) {
      // A date should have been added by the convertV2 function
      throw new Error(`No date found for ${v2Request.currency_pair}`)
    }

    let exchangeRate: string | null = null
    let error: string | undefined

    try {
      // Get rate lookup functions based on pair type
      const getFromRate = parsed.isFiatFrom ? findFiatRate : findCryptoRate
      const getToRate = parsed.isFiatTo ? findFiatRate : findCryptoRate

      const fromRate = getFromRate(parsed.from, parsed.date)
      const toRate = getToRate(parsed.to, parsed.date)

      if (fromRate === undefined) {
        error = `No rate found for ${parsed.from}`
      } else if (toRate === undefined) {
        error = `No rate found for ${parsed.to}`
      } else {
        exchangeRate = String(fromRate / toRate)
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
