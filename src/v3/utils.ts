import {
  CryptoRate,
  EdgeCurrencyPluginId,
  EdgeTokenId,
  FiatRate
} from './types'

export const toCryptoRateKey = (rate: CryptoRate): string => {
  return `${rate.isoDate.toISOString()}_${rate.asset.pluginId}_${String(
    rate.asset.tokenId
  )}`
}
export const toFiatRateKey = (rate: FiatRate): string => {
  return `${rate.isoDate.toISOString()}_${rate.fiatCode}`
}

function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`)
}

// Create a tokenId from a contract address and currency code.
export const createTokenId = (
  pluginId: EdgeCurrencyPluginId,
  currencyCode: string,
  contractAddress?: string
): EdgeTokenId => {
  switch (pluginId) {
    // No token support:
    case 'binance':
    case 'bitcoin':
    case 'bitcoincash':
    case 'bitcoingold':
    case 'bitcoinsv':
    case 'cardano':
    case 'dash':
    case 'digibyte':
    case 'dogecoin':
    case 'eboost':
    case 'ecash':
    case 'eos':
    case 'feathercoin':
    case 'filecoin':
    case 'fio':
    case 'groestlcoin':
    case 'hedera':
    case 'litecoin':
    case 'monero':
    case 'piratechain':
    case 'pivx':
    case 'polkadot':
    case 'qtum':
    case 'ravencoin':
    case 'smartcash':
    case 'stellar':
    case 'telos':
    case 'tezos':
    case 'ton':
    case 'ufo':
    case 'vertcoin':
    case 'wax':
    case 'zcash':
    case 'zcoin': {
      if (contractAddress != null) {
        // these chains don't support tokens
        throw new Error('Tokens are not supported for this chain')
      }
      return null
    }

    // EVM token support:
    case 'arbitrum':
    case 'avalanche':
    case 'base':
    case 'binancesmartchain':
    case 'bobevm':
    case 'celo':
    case 'ethereum':
    case 'ethereumclassic':
    case 'ethereumpow':
    case 'fantom':
    case 'filecoinfevm':
    case 'hyperevm':
    case 'optimism':
    case 'polygon':
    case 'pulsechain':
    case 'rsk':
    case 'sonic':
    case 'zksync': {
      if (contractAddress != null) {
        return contractAddress.toLowerCase().replace(/^0x/, '')
      }
      return null
    }

    // Algorand token support:
    case 'algorand': {
      if (contractAddress != null) {
        return contractAddress
      }
      return null
    }

    // Cosmos token support:
    case 'axelar':
    case 'coreum':
    case 'cosmoshub':
    case 'osmosis':
    case 'thorchainrune': {
      if (contractAddress != null) {
        // Regexes inspired by a general regex in https://github.com/cosmos/cosmos-sdk
        // Broken up to more tightly enforce the rules for each type of asset so the entered value matches what a node would expect
        const ibcDenomRegex = /^ibc\/[0-9A-F]{64}$/
        const nativeDenomRegex = /^(?!ibc)[a-z][a-z0-9/]{2,127}/

        if (
          contractAddress == null ||
          (!ibcDenomRegex.test(contractAddress) &&
            !nativeDenomRegex.test(contractAddress))
        ) {
          throw new Error('Invalid contract address')
        }

        return contractAddress.toLowerCase().replace(/\//g, '')
      }
      return null
    }

    // Substrate token support:
    case 'liberland': {
      if (contractAddress != null) {
        return contractAddress
      }
      return null
    }

    // XRP token support:
    case 'ripple': {
      if (contractAddress != null) {
        let currency: string
        if (currencyCode.length > 3) {
          const hexCode = Buffer.from(currencyCode, 'utf8').toString('hex')
          currency = hexCode.toUpperCase().padEnd(40, '0')
        } else {
          currency = currencyCode
        }

        return `${currency}-${contractAddress}`
      }
      return null
    }

    // Solana token support:
    case 'solana': {
      if (contractAddress != null) {
        return contractAddress
      }
      return null
    }

    // Sui token support:
    case 'sui': {
      if (contractAddress != null) {
        return contractAddress.replace(/:/g, '')
      }
      return null
    }

    // Tron token support:
    case 'tron': {
      if (contractAddress != null) {
        return contractAddress
      }
      return null
    }

    // Zano token support:
    case 'zano': {
      if (contractAddress != null) {
        return contractAddress.toLowerCase()
      }
      return null
    }

    // Make sure we handle all cases:
    default: {
      return assertNever(pluginId)
    }
  }
}
