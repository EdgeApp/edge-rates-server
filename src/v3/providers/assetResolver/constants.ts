/**
 * Sorted set of `pluginId_tokenId` keys that `/v3/rates` returned without a
 * rate, scored by request count. Drained by the daily engine.
 */
export const unresolvedAssetsKey = 'assetResolver:unresolved'
