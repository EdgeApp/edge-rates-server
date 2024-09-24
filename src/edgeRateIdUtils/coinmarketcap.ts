import {
  asArray,
  asEither,
  asMaybe,
  asNull,
  asNumber,
  asObject,
  asString,
  asUnknown
} from 'cleaners'
import { join } from 'path'

import { makeNodeDisklet } from '../../node_modules/disklet'
import { config } from '../config'
import { snooze } from '../utils/utils'
import {
  contractAddressToTokenId,
  CreateTokenId,
  EdgePluginIdPlatformMap,
  EdgeTokenIdUniqueIdMap
} from './tokenIdUtils'

const asCoinmarketcapAsset = asObject({
  id: asNumber,
  name: asString,
  symbol: asString,
  // slug: asString,
  // is_active: asMaybe(asNumber),

  platform: asEither(
    asNull,
    asObject({
      id: asNumber,
      name: asString,
      symbol: asString,
      // slug: asString,
      // eslint-disable-next-line @typescript-eslint/camelcase
      token_address: asString
    })
  )
})

const asCoinmarketcapRes = asObject({
  status: asUnknown,
  data: asArray(asCoinmarketcapAsset)
})

const asCoinmarketcapMetadata = asObject(
  asObject({
    id: asNumber,
    name: asString,
    symbol: asString,
    // platform: asObject({
    //   id: asString,
    //   name: asString,
    //   slug: asString,
    //   symbol: asString,
    //   // eslint-disable-next-line @typescript-eslint/camelcase
    //   token_address: asString
    // }),
    // eslint-disable-next-line @typescript-eslint/camelcase
    contract_address: asArray(
      asObject({
        // eslint-disable-next-line @typescript-eslint/camelcase
        contract_address: asString,
        platform: asObject({
          name: asString,
          coin: asObject({
            id: asString,
            name: asString,
            symbol: asString,
            slug: asString
          })
        })
      })
    )
  })
)

const asCoinmarketcapMetadataRes = asObject({
  status: asUnknown,
  data: asCoinmarketcapMetadata
})

export const coinmarketcap = async (): Promise<EdgeTokenIdUniqueIdMap> => {
  const disklet = makeNodeDisklet(join(__dirname, './'))
  const files = await disklet.list('./data')
  if (files['data/coinmarketcap.json'] == null) {
    await disklet.setText('./data/coinmarketcap.json', '{}')
  }
  const savedJson = JSON.parse(
    await disklet.getText('./data/coinmarketcap.json')
  )

  const { apiKey } = config.providers.coinMarketCapHistorical

  const numberOfAssets = Object.keys(savedJson).length
  const ITEMS_PER_PAGE = 5000
  let page = Math.floor(numberOfAssets / ITEMS_PER_PAGE)
  let foundNew = false
  while (true) {
    const res = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?listing_status=active,inactive,untracked&start=${page *
        ITEMS_PER_PAGE +
        1}`,
      { headers: { 'X-CMC_PRO_API_KEY': apiKey } }
    )
    const json = await res.json()
    const clean = asCoinmarketcapRes(json)

    for (const asset of clean.data) {
      if (savedJson[asset.id] == null) {
        foundNew = true
        savedJson[asset.id] = asset
      }
    }
    if (clean.data.length < ITEMS_PER_PAGE) {
      break
    }
    page++
    await snooze(1000)
  }

  if (foundNew) {
    await disklet.setText(
      './data/coinmarketcap.json',
      JSON.stringify(savedJson)
    )
  }

  const coinmarketcapPluginIdMap: { [key: string]: string } = {}
  for (const [key, value] of Object.entries(edgePluginIdToCoinmarketcapId)) {
    if (value != null) coinmarketcapPluginIdMap[value] = key
  }

  const out: EdgeTokenIdUniqueIdMap = {}

  const metadataNeededIds: number[] = []
  for (const asset of Object.values(savedJson)) {
    const cleanAsset = asMaybe(asCoinmarketcapAsset)(asset)
    if (cleanAsset == null) continue
    if (cleanAsset.platform !== null) {
      metadataNeededIds.push(cleanAsset.id)
    } else {
      const parentPluginId = coinmarketcapPluginIdMap[cleanAsset.id]
      if (parentPluginId == null) continue

      const parentEdgeRateId = `${parentPluginId}_null`
      out[parentEdgeRateId] = cleanAsset.id.toString()
    }
  }

  const METADATA_LIMIT_PER_PAGE = 100
  for (let i = 0; i < metadataNeededIds.length; i += METADATA_LIMIT_PER_PAGE) {
    if (i > 500) break
    const chunk = metadataNeededIds.slice(i, i + METADATA_LIMIT_PER_PAGE)
    const res = await fetch(
      `https://pro-api.coinmarketcap.com/v2/cryptocurrency/info?id=${chunk.join(
        ','
      )}&aux=platform`,
      { headers: { 'X-CMC_PRO_API_KEY': apiKey } }
    )
    const json = await res.json()
    const clean = asCoinmarketcapMetadataRes(json)

    for (const asset of Object.values(clean.data)) {
      const { contract_address: contractAddresses, id } = asset
      for (const contractAddress of contractAddresses) {
        const { contract_address: address, platform } = contractAddress
        const parentPluginId = coinmarketcapPluginIdMap[platform.coin.id]
        if (parentPluginId == null) continue
        const parentEdgeRateId = `${parentPluginId}_null`
        if (out[parentEdgeRateId] == null) {
          out[parentEdgeRateId] = platform.coin.id
        }

        const toTokenId: CreateTokenId | null =
          contractAddressToTokenId[parentPluginId]
        if (toTokenId == null) continue
        const tokenEdgeRateId = `${parentPluginId}_${toTokenId(address)}`
        out[tokenEdgeRateId] = id.toString()
      }
    }
  }

  return out
}

export const edgePluginIdToCoinmarketcapId: EdgePluginIdPlatformMap = {
  // edge-currency-accountbased:
  amoy: null, // Polygon testnet
  arbitrum: '11841',
  algorand: '4030',
  avalanche: '5805',
  axelar: '17799',
  base: '7838',
  binance: null,
  binancesmartchain: '1839',
  bobevm: null,
  cardano: '2010',
  cardanotestnet: null, // Cardano Testnet
  celo: '5567',
  coreum: '16399',
  cosmoshub: '3794',
  eos: '1765',
  ethereum: '1027',
  ethereumclassic: '1321',
  ethereumpow: '21296',
  fantom: '3513',
  filecoin: null,
  filecoinfevm: '2280',
  filecoinfevmcalibration: null, // FilecoinEVM testnet
  fio: '5865',
  hedera: '4642',
  holesky: null, // Ethereum Testnet
  liberland: null,
  liberlandtestnet: null, // Liberland testnet
  optimism: '11840',
  osmosis: '12220',
  piratechain: '3951',
  polkadot: '6636',
  polygon: '3890',
  pulsechain: '28928',
  ripple: '52',
  rsk: '3626',
  sepolia: null, // Ethereum Testnet
  solana: '5426',
  stellar: '512',
  telos: '4660',
  tezos: '2011',
  thorchainrune: '4157',
  tron: '1958',
  wax: '2300',
  zksync: '24091',
  zcash: '1437',
  // edge-currency-bitcoin:
  bitcoin: '1',
  bitcoincash: '1831',
  bitcoincashtestnet: null,
  bitcoingold: '2083',
  bitcoingoldtestnet: null,
  bitcoinsv: '3602',
  bitcointestnet: null,
  dash: '131',
  digibyte: '109',
  dogecoin: '74',
  eboost: '1704',
  feathercoin: '8',
  groestlcoin: '258',
  litecoin: '2',
  qtum: '1684',
  ravencoin: '2577',
  smartcash: '1828',
  ufo: '168',
  vertcoin: '99',
  zcoin: '1414',
  // edge-currency-monero:
  monero: '328'
}

if (process.argv[1].includes('coinmarketcap.ts')) {
  coinmarketcap()
    .then(data => console.log(data))
    .catch(console.error)
}
