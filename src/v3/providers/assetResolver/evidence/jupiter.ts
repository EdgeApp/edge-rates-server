import { asMaybe } from 'cleaners'

import {
  asJupiterSearch,
  asJupiterToken,
  type FetchJson,
  type JupiterToken
} from './types'

/** Jupiter's metadata and verification tags for a Solana mint. */
export const fetchJupiterToken = async (
  fetchJson: FetchJson,
  mint: string
): Promise<JupiterToken | undefined> => {
  const { status, body } = await fetchJson(
    `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`
  )
  if (status === 404) return
  if (status !== 200) throw new Error(`Jupiter replied ${status}`)
  for (const raw of asJupiterSearch(body)) {
    const token = asMaybe(asJupiterToken)(raw)
    if (token?.id === mint) return token
  }
}
