import { asArray, asObject, asString } from 'cleaners'

import { config } from '../config'
import {
  contractAddressToTokenId,
  CreateTokenId,
  EdgePluginIdPlatformMap,
  EdgeTokenIdUniqueIdMap
} from './tokenIdUtils'

const asCoinGeckoAssets = asArray(
  asObject({
    id: asString,
    symbol: asString,
    name: asString,
    platforms: asObject(asString)
  })
)

export const coingecko = async (): Promise<EdgeTokenIdUniqueIdMap> => {
  const { apiKey } = config.providers.coingeckopro

  const res = await fetch(
    'https://pro-api.coingecko.com/api/v3/coins/list?include_platform=true',
    { headers: { 'x-cg-pro-api-key': apiKey } }
  )
  const json = await res.json()
  const assets = asCoinGeckoAssets(json)

  const coingeckoPluginIdMap: { [key: string]: string } = {}
  for (const [key, value] of Object.entries(edgePluginIdToCoingeckoId)) {
    if (value != null) coingeckoPluginIdMap[value] = key
  }
  const coingeckoPlatformPluginIdMap: { [key: string]: string } = {}
  for (const [key, value] of Object.entries(
    edgePluginIdToCoingeckoIdPlatform
  )) {
    if (value != null) coingeckoPlatformPluginIdMap[value] = key
  }

  const out: EdgeTokenIdUniqueIdMap = {}
  for (const asset of assets) {
    if (asset.id in coingeckoPluginIdMap) {
      const edgeRateId = `${coingeckoPluginIdMap[asset.id]}_null`
      out[edgeRateId] = asset.id
    } else {
      for (const [platform, contractAddress] of Object.entries(
        asset.platforms
      )) {
        const parentPluginId = coingeckoPlatformPluginIdMap[platform]
        if (parentPluginId == null) continue

        const toTokenId: CreateTokenId | null =
          contractAddressToTokenId[parentPluginId]
        if (toTokenId == null) continue

        const tokenEdgeRateId = `${parentPluginId}_${toTokenId(
          contractAddress
        )}`
        out[tokenEdgeRateId] = asset.id
      }
    }
  }

  return out
}

export const edgePluginIdToCoingeckoIdPlatform: EdgePluginIdPlatformMap = {
  // edge-currency-accountbased:
  amoy: null, // Polygontestnet
  arbitrum: 'arbitrum-one',
  algorand: 'algorand',
  avalanche: 'avalanche',
  axelar: null,
  base: 'base',
  binance: 'binancecoin',
  binancesmartchain: 'binance-smart-chain',
  bobevm: 'bob-network',
  cardano: 'cardano',
  cardanotestnet: null, // CardanoTestnet
  celo: 'celo',
  coreum: null,
  cosmoshub: 'cosmos',
  eos: 'eos',
  ethereum: 'ethereum',
  ethereumclassic: 'ethereum-classic',
  ethereumpow: 'ethereumpow',
  fantom: 'fantom',
  filecoin: null,
  filecoinfevm: 'filecoin',
  filecoinfevmcalibration: null, // FilecoinEVMtestnet
  fio: null,
  hedera: 'hedera-hashgraph',
  holesky: null, // EthereumTestnet
  liberland: null,
  liberlandtestnet: null, // Liberland testnet
  optimism: 'optimistic-ethereum',
  osmosis: 'osmosis',
  piratechain: null,
  polkadot: null,
  polygon: 'polygon-pos',
  pulsechain: 'pulsechain',
  ripple: 'xrp',
  rsk: 'rootstock',
  sepolia: null, // EthereumTestnet
  solana: 'solana',
  stellar: 'stellar',
  telos: 'telos',
  tezos: 'tezos',
  thorchainrune: null,
  tron: 'tron',
  wax: 'wax',
  zksync: 'zksync',
  zcash: null,
  // edge-currency-bitcoin:
  bitcoin: null,
  bitcoincash: null,
  bitcoincashtestnet: null,
  bitcoingold: null,
  bitcoingoldtestnet: null,
  bitcoinsv: null,
  bitcointestnet: null,
  dash: null,
  digibyte: null,
  dogecoin: null,
  eboost: null,
  feathercoin: null,
  groestlcoin: null,
  litecoin: null,
  qtum: null,
  ravencoin: null,
  smartcash: null,
  ufo: null,
  vertcoin: null,
  zcoin: null,
  // edge-currency-monero:
  monero: null
}

// const getPlatformIds = (
//   data: ReturnType<typeof asCoinGeckoAssets>
// ): string[] => {
//   const out = new Set<string>()
//   for (const asset of data) {
//     for (const platform of Object.keys(asset.platforms)) {
//       out.add(platform)
//     }
//   }
//   return [...out]
// }

export const edgePluginIdToCoingeckoId: EdgePluginIdPlatformMap = {
  // edge-currency-accountbased:
  amoy: null, // Polygontestnet
  arbitrum: 'arbitrum-one',
  algorand: 'algorand',
  avalanche: 'avalanche',
  axelar: 'axelar',
  base: 'base',
  binance: 'binancecoin',
  binancesmartchain: 'binance-smart-chain',
  bobevm: 'bob-network', // TODO:
  cardano: 'cardano',
  cardanotestnet: null, // CardanoTestnet
  celo: 'celo',
  coreum: 'coreum',
  cosmoshub: 'cosmos',
  eos: 'eos',
  ethereum: 'ethereum',
  ethereumclassic: 'ethereum-classic',
  ethereumpow: 'ethereumpow',
  fantom: 'fantom',
  filecoin: null,
  filecoinfevm: 'filecoin',
  filecoinfevmcalibration: null, // FilecoinEVMtestnet
  fio: 'fio-protocol',
  hedera: 'hedera-hashgraph',
  holesky: null, // EthereumTestnet
  liberland: 'liberland-lld',
  liberlandtestnet: null, // Liberland testnet
  optimism: 'optimistic-ethereum',
  osmosis: 'osmosis',
  piratechain: 'pirate-chain',
  polkadot: 'polkadot',
  polygon: 'matic-network',
  pulsechain: 'pulsechain',
  ripple: 'ripple',
  rsk: 'rootstock',
  sepolia: null, // EthereumTestnet
  solana: 'solana',
  stellar: 'stellar',
  telos: 'telos',
  tezos: 'tezos',
  thorchainrune: 'thorchain',
  tron: 'tron',
  wax: 'wax',
  zksync: 'zksync',
  zcash: 'zcash',
  // edge-currency-bitcoin:
  bitcoin: 'bitcoin',
  bitcoincash: 'bitcoin-cash',
  bitcoincashtestnet: null,
  bitcoingold: 'bitcoin-gold',
  bitcoingoldtestnet: null,
  bitcoinsv: 'bitcoin-cash-sv',
  bitcointestnet: null,
  dash: 'dash',
  digibyte: 'digibyte',
  dogecoin: 'dogecoin',
  eboost: 'eboost',
  feathercoin: 'feathercoin',
  groestlcoin: 'groestlcoin',
  litecoin: 'litecoin',
  qtum: 'qtum',
  ravencoin: 'ravencoin',
  smartcash: 'smartcash',
  ufo: 'ufocoin',
  vertcoin: 'vertcoin',
  zcoin: 'zcoin',
  // edge-currency-monero:
  monero: 'monero'
}

if (process.argv[1].includes('coingecko.ts')) {
  coingecko()
    .then(data => console.log(data))
    .catch(console.error)
}
