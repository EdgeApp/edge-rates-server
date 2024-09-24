export type CreateTokenId = (contractAddress: string) => string

const toEvmTokenId: CreateTokenId = (contractAddress: string): string =>
  contractAddress.replace('0x', '').toLowerCase()
const toCosmosTokenId: CreateTokenId = (contractAddress: string): string =>
  contractAddress.toLowerCase().replace(/\//g, '')
const toEosTokenId: CreateTokenId = (contractAddress: string): string =>
  contractAddress.toLowerCase()
const toDefaultTokenId: CreateTokenId = (contractAddress: string): string =>
  contractAddress // Use the contract address as-is

export const contractAddressToTokenId = {
  // edge-currency-accountbased:
  algorand: toDefaultTokenId,
  amoy: toEvmTokenId, // Polygon testnet
  arbitrum: toEvmTokenId,
  avalanche: toEvmTokenId,
  axelar: toCosmosTokenId,
  base: toEvmTokenId,
  binance: null,
  binancesmartchain: toEvmTokenId,
  bobevm: toEvmTokenId,
  cardano: null,
  cardanotestnet: null, // Cardano Testnet
  celo: toEvmTokenId,
  coreum: toCosmosTokenId,
  cosmoshub: toCosmosTokenId,
  eos: toEosTokenId,
  ethereum: toEvmTokenId,
  ethereumclassic: toEvmTokenId,
  ethereumpow: toEvmTokenId,
  fantom: toEvmTokenId,
  filecoin: null,
  filecoinfevm: toEvmTokenId,
  filecoinfevmcalibration: toEvmTokenId, // FilecoinEVM testnet
  fio: null,
  hedera: null,
  holesky: toEvmTokenId, // Ethereum Testnet
  liberland: null,
  liberlandtestnet: null, // Liberland testnet
  optimism: toEvmTokenId,
  osmosis: toCosmosTokenId,
  piratechain: null,
  polkadot: toDefaultTokenId,
  polygon: toEvmTokenId,
  pulsechain: toEvmTokenId,
  ripple: null,
  rsk: toEvmTokenId,
  sepolia: toEvmTokenId, // Ethereum Testnet
  solana: toDefaultTokenId,
  stellar: null,
  telos: toEosTokenId,
  tezos: null,
  thorchainrune: toCosmosTokenId,
  tron: toDefaultTokenId,
  wax: toEosTokenId,
  zcash: null,
  zksync: toEvmTokenId,
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

export type EdgePluginIds = keyof typeof contractAddressToTokenId

export type EdgePluginIdPlatformMap = {
  [key in EdgePluginIds]: string | null
}

export interface EdgeTokenIdUniqueIdMap {
  [key: string]: string
}
