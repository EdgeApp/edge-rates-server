import {
  asEtherscanSourceResponse,
  type EtherscanContract,
  type FetchJson
} from './types'

/** Whether an EVM contract has verified source, via the Etherscan V2 API. */
export const fetchEtherscanContract = async (
  fetchJson: FetchJson,
  chainId: number,
  address: string,
  apiKey: string
): Promise<EtherscanContract | undefined> => {
  const { status, body } = await fetchJson(
    `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`
  )
  if (status !== 200) throw new Error(`Etherscan replied ${status}`)
  const reply = asEtherscanSourceResponse(body)
  if (typeof reply.result === 'string') throw new Error(reply.result)
  const [contract] = reply.result
  if (contract == null) return
  return {
    verified: contract.SourceCode != null && contract.SourceCode !== '',
    contractName: contract.ContractName,
    proxy: contract.Proxy === '1'
  }
}
