import {
  asGoPlusResponse,
  asGoPlusToken,
  type FetchJson,
  type GoPlusToken
} from './types'

/** Chains GoPlus token security covers, by its own chain id. */
export const goPlusChainIds = new Set([
  '1',
  '10',
  '25',
  '56',
  '100',
  '128',
  '137',
  '146',
  '169',
  '177',
  '196',
  '204',
  '250',
  '321',
  '324',
  '480',
  '1514',
  '1625',
  '2741',
  '2818',
  '4200',
  '5000',
  '8453',
  '10143',
  '42161',
  '42766',
  '43114',
  '48899',
  '59144',
  '80094',
  '81457',
  '200901',
  '201022',
  '534352',
  '810180',
  'tron'
])

/** The GoPlus chain id for an Edge asset, or undefined when uncovered. */
export const toGoPlusChainId = (
  pluginId: string,
  evmChainId: number | undefined
): string | undefined => {
  const chainId = pluginId === 'tron' ? 'tron' : String(evmChainId)
  return goPlusChainIds.has(chainId) ? chainId : undefined
}

export const fetchGoPlusToken = async (
  fetchJson: FetchJson,
  chainId: string,
  address: string,
  apiKey?: string
): Promise<GoPlusToken | undefined> => {
  const headers: Record<string, string> =
    apiKey != null && apiKey !== '' ? { authorization: `Bearer ${apiKey}` } : {}
  const { status, body } = await fetchJson(
    `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`,
    { headers }
  )
  if (status !== 200) throw new Error(`GoPlus replied ${status}`)
  const { code, message, result } = asGoPlusResponse(body)
  if (code !== 1) throw new Error(`GoPlus error ${code}: ${message ?? ''}`)
  const raw = result[address.toLowerCase()] ?? result[address]
  if (raw == null) return
  return asGoPlusToken(raw)
}
