/**
 * Sorted set of `pluginId_tokenId` keys that `/v3/rates` returned without a
 * rate, scored by request count. Drained by the daily engine.
 */
export const unresolvedAssetsKey = 'assetResolver:unresolved'

/** The set a daily run is processing; unioned back in if the run dies. */
export const unresolvedAssetsDrainingKey = 'assetResolver:unresolved:draining'

/** The most keys a daily run reads out of the drained set. */
export const maxDrainedAssets = 1000

export const dailyLockKeyPrefix = 'assetResolver:lock'
export const dailyLockTtlSeconds = 36 * 60 * 60
