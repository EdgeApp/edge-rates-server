import { asMaybe } from 'cleaners'

import {
  asChainRegistryAsset,
  asChainRegistryAssetList,
  type ChainRegistryAsset,
  type FetchJson
} from './types'

/** The cosmos chain-registry entry for a denom, with its IBC trace. */
export const fetchChainRegistryAsset = async (
  fetchJson: FetchJson,
  chainName: string,
  denom: string
): Promise<ChainRegistryAsset | undefined> => {
  const { status, body } = await fetchJson(
    `https://raw.githubusercontent.com/cosmos/chain-registry/master/${chainName}/assetlist.json`
  )
  if (status !== 200) throw new Error(`Chain registry replied ${status}`)
  for (const raw of asChainRegistryAssetList(body).assets) {
    const asset = asMaybe(asChainRegistryAsset)(raw)
    if (asset == null || asset.base !== denom) continue
    return {
      base: asset.base,
      symbol: asset.symbol,
      name: asset.name,
      coingeckoId: asset.coingecko_id,
      traces: asset.traces.map(trace => ({
        type: trace.type,
        chainName: trace.counterparty?.chain_name,
        baseDenom: trace.counterparty?.base_denom
      }))
    }
  }
}
