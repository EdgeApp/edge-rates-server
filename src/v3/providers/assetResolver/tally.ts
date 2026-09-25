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

/** Turns a `[member, score, member, score, ...]` reply into counts. */
export const parseScoredMembers = (reply: string[]): Map<string, number> => {
  const counts = new Map<string, number>()
  for (let i = 0; i + 1 < reply.length; i += 2) {
    counts.set(reply[i], Number(reply[i + 1]))
  }
  return counts
}
