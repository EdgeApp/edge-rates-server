import { client } from '../redis'
import {
  dailyLockKeyPrefix,
  dailyLockTtlSeconds,
  unresolvedAssetsDrainingKey,
  unresolvedAssetsKey
} from './constants'
import { parseScoredMembers } from './tally'

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

// The client does not expose ZREVRANGE, so the drain runs as a script, the
// same way the edgerates leaderboard is read:
const drainScript = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  redis.call('ZUNIONSTORE', KEYS[2], 2, KEYS[1], KEYS[2])
  redis.call('DEL', KEYS[1])
end
return redis.call('ZREVRANGE', KEYS[2], 0, tonumber(ARGV[1]) - 1, 'WITHSCORES')
`

/**
 * Moves the recorded keys into the draining set and returns the most
 * requested ones. A run that dies leaves the draining set in place, and the
 * next run unions the new keys into it, so nothing is lost.
 */
export const drainUnresolvedAssets = async (
  limit: number
): Promise<Map<string, number>> => {
  const reply = (await client.eval(drainScript, {
    keys: [unresolvedAssetsKey, unresolvedAssetsDrainingKey],
    arguments: [String(limit)]
  })) as string[]
  return parseScoredMembers(reply)
}

/** Forgets the drained keys once the report about them has been posted. */
export const finishDrain = async (): Promise<void> => {
  await client.del(unresolvedAssetsDrainingKey)
}

/** Claims the one run allowed per UTC day, surviving the daily pm2 restart. */
export const claimDailyRun = async (
  day: string,
  rightNow: Date
): Promise<boolean> => {
  const reply = await client.set(
    `${dailyLockKeyPrefix}:${day}`,
    rightNow.toISOString(),
    { NX: true, EX: dailyLockTtlSeconds }
  )
  return reply != null
}

/** Lets the next hourly tick retry a run that failed. */
export const releaseDailyRun = async (day: string): Promise<void> => {
  await client.del(`${dailyLockKeyPrefix}:${day}`)
}
