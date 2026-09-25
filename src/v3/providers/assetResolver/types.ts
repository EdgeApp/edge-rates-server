import { asObject, asOptional, asString } from 'cleaners'

/**
 * One entry of the hand-edited `assetResolver` document, keyed by
 * `pluginId_tokenId`. The asset stays out of reports and resolution until the
 * `until` day (YYYY-MM-DD, UTC), or forever when `until` is omitted.
 */
export const asIgnoreEntry = asObject({
  reason: asString,
  until: asOptional(asString)
})
export type IgnoreEntry = ReturnType<typeof asIgnoreEntry>

export const asIgnoreMap = asObject(asIgnoreEntry)
export type IgnoreMap = ReturnType<typeof asIgnoreMap>
