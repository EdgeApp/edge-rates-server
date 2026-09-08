import bundledV2CurrencyCodeMapJson from '../../data/v2CurrencyCodeMap.json'
import { asV2CurrencyCodeMap } from './types'

/**
 * The map that seeds the `v2CurrencyCodeMap` document in `rates_settings`, and
 * the map v2 conversions fall back to while that document has not synced.
 *
 * Loaded and cleaned here so the seed and the fallback are one value rather
 * than one file read two ways, and so the fallback is held to the same shape as
 * the synced document. It is the only source of v2 mappings during a CouchDB
 * outage, and would otherwise be the one path able to drift silently: a
 * malformed file now fails at startup instead of producing wrong conversions.
 */
export const bundledV2CurrencyCodeMap = asV2CurrencyCodeMap(
  bundledV2CurrencyCodeMapJson
)
