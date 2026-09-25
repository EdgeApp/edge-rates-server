import { client } from '../redis'
import { unresolvedAssetsKey } from './constants'

/**
 * Counts one request per key, the same way the edgerates leaderboard does.
 * Counts include the edgerates warmer re-requesting the leaderboard, so they
 * rank assets rather than measure user demand exactly.
 */
export const recordUnresolvedAssets = async (keys: string[]): Promise<void> => {
  if (keys.length === 0) return
  const pipeline = client.multi()
  for (const key of keys) {
    pipeline.zIncrBy(unresolvedAssetsKey, 1, key)
  }
  await pipeline.exec()
}
