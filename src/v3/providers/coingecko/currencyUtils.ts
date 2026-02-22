import { Connection, PublicKey } from '@solana/web3.js'
import { asString } from 'cleaners'

import { logger } from '../../../utils/utils'
import type { JsonObject, NetworkLocationTypeMap } from '../../types'

const solanaRpc = 'https://api.mainnet-beta.solana.com'
const solanaConnection = new Connection(solanaRpc)

const createSolanaNetworkLocation = async (
  contractAddress: string
): Promise<JsonObject | undefined> => {
  try {
    const accountInfo = await solanaConnection.getAccountInfo(
      new PublicKey(contractAddress)
    )
    if (accountInfo == null) return

    const owner = accountInfo.owner.toBase58()
    logger(`createSolanaNetworkLocation success ${contractAddress} ${owner}`)

    return {
      contractAddress,
      tokenProgram: owner
    }
  } catch (e) {
    logger(`createSolanaNetworkLocation error ${contractAddress} ${String(e)}`)
  }
}

const createRippleNetworkLocation = async (
  contractAddress: string
): Promise<JsonObject | undefined> => {
  try {
    const [currency, issuer] = contractAddress.split('.')

    return {
      currency: asString(currency),
      issuer: asString(issuer)
    }
  } catch (e) {
    logger(`createRippleNetworkLocation error ${contractAddress} ${String(e)}`)
  }
}

export const getNetworkLocation = async (
  networkLocationType: NetworkLocationTypeMap[string],
  contractAddress: string
): Promise<JsonObject | undefined> => {
  switch (networkLocationType) {
    case 'xrpl':
      return await createRippleNetworkLocation(contractAddress)
    case 'solana':
      return await createSolanaNetworkLocation(contractAddress)
    default:
      return { contractAddress }
  }
}
