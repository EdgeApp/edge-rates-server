import type { CryptoRate } from '../../types'
import { toCryptoKey } from '../../utils'

/**
 * Keys of the requested assets that are about to be returned without a rate,
 * one per asset regardless of how many dates were requested for it.
 */
export const collectUnresolvedKeys = (rates: CryptoRate[]): string[] => {
  const keys = new Set<string>()
  for (const rate of rates) {
    if (rate.rate != null) continue
    keys.add(toCryptoKey(rate.asset))
  }
  return Array.from(keys)
}
