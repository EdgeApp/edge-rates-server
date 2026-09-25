import {
  asRugCheckSummary,
  type FetchJson,
  type RugCheckSummary
} from './types'

/** RugCheck's risk summary for a Solana mint. */
export const fetchRugCheckSummary = async (
  fetchJson: FetchJson,
  mint: string
): Promise<RugCheckSummary | undefined> => {
  const { status, body } = await fetchJson(
    `https://api.rugcheck.xyz/v1/tokens/${encodeURIComponent(
      mint
    )}/report/summary`
  )
  if (status === 404) return
  if (status !== 200) throw new Error(`RugCheck replied ${status}`)
  return asRugCheckSummary(body)
}
