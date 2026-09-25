import { asDefiLlamaPrices, type DefiLlamaToken, type FetchJson } from './types'

/** DefiLlama's current price, symbol, and decimals for a token, or undefined. */
export const fetchDefiLlamaToken = async (
  fetchJson: FetchJson,
  chainSlug: string,
  address: string
): Promise<DefiLlamaToken | undefined> => {
  const id = `${chainSlug}:${address}`
  const { status, body } = await fetchJson(
    `https://coins.llama.fi/prices/current/${id}`
  )
  if (status !== 200) throw new Error(`DefiLlama replied ${status}`)
  const { coins } = asDefiLlamaPrices(body)
  const coin = coins[id] ?? coins[id.toLowerCase()]
  if (coin == null) return
  return {
    symbol: coin.symbol,
    decimals: coin.decimals,
    price: coin.price,
    confidence: coin.confidence
  }
}
