import fetch from 'node-fetch'

import { config } from './../config'

const coinmarketcapEdgeMap = {
  BTC: 'bitcoin',
  BCH: 'bitcoin-cash',
  BTG: 'bitcoin-gold',
  BSV: 'bitcoin-sv',
  DASH: 'dash',
  DGB: 'digibyte',
  DOGE: 'dogecoin',
  EBST: 'eboostcoin',
  FTC: 'feathercoin',
  GRS: 'groestlcoin',
  LTC: 'litecoin',
  QTUM: 'qtum',
  RVN: 'ravencoin',
  SMART: 'smartcash',
  UFO: 'uniform-fiscal-object',
  VTC: 'vertcoin',
  FIRO: 'firo',
  XMR: 'monero',
  XRP: 'xrp',
  XTZ: 'tezos',
  XLM: 'stellar',
  FIO: 'fio-protocol',
  EOS: 'eos',
  BNB: 'binance-coin',
  RSK: 'rsk-smart-bitcoin',
  ETH: 'ethereum',
  ETC: 'ethereum-classic',
  REP: 'augur',
  DAI: 'multi-collateral-dai',
  WINGS: 'wings',
  USDT: 'tether',
  IND: 'indorse-token',
  ANT: 'aragon',
  BAT: 'basic-attention-token',
  BNT: 'bancor',
  KNC: 'kyber-network-crystal-legacy',
  POLY: 'polymath-network',
  STORJ: 'storj',
  USDC: 'usd-coin',
  USDS: 'stableusd',
  TUSD: 'trueusd',
  ZRX: '0x',
  GNO: 'gnosis-gno',
  OMG: 'omg',
  NMR: 'numeraire',
  MKR: 'maker',
  GUSD: 'gemini-dollar',
  PAX: 'paxos-standard',
  SALT: 'salt',
  MANA: 'decentraland',
  NEXO: 'nexo',
  FUN: 'funtoken',
  KIN: 'kin',
  LINK: 'link',
  BRZ: 'brz',
  OXT: 'orchid',
  COMP: 'compound',
  MET: 'metronome',
  SNX: 'synthetix-network-token',
  SUSD: 'susd',
  SBTC: 'sbtc',
  AAVE: 'aave',
  WBTC: 'wrapped-bitcoin',
  YFI: 'yearn-finance',
  CRV: 'curve-dao-token',
  BAL: 'balancer',
  SUSHI: 'sushiswap',
  UMA: 'uma',
  BADGER: 'badger-dao',
  IDLE: 'idle',
  NXM: 'nxm',
  CREAM: 'cream-finance',
  PICKLE: 'pickle-finance',
  CVP: 'powerpool',
  ROOK: 'keeperdao',
  DOUGH: 'piedao-dough-v2',
  COMBO: 'furucombo',
  INDEX: 'index-cooperative',
  WETH: 'weth',
  RENBTC: 'renbtc',
  RENZEC: 'renzec',
  DPI: 'defi-pulse-index',
  YETI: 'yearn-ecosystem-token-index',
  BAND: 'band-protocol',
  REN: 'ren',
  AMPL: 'ampleforth',
  OCEAN: 'ocean-protocol',
  GLM: 'golem-network-tokens',
  UNI: 'uniswap'
}

const edgeIDs = {}
const defaultsIds = {}

const coinmarketcapIsDumb = async () => {
  const response = await fetch(
    `https://pro-api.coinmarketcap.com/v1/cryptocurrency/map`,
    {
      method: 'GET',
      headers: {
        'X-CMC_PRO_API_KEY': config.coinMarketCapHistoricalApiKey
      },
      json: true
    }
  )
  const json = await response.json()
  for (const key of json.data) {
    // const obj = json.data[key]
    if (key.slug === coinmarketcapEdgeMap[key.symbol]) {
      edgeIDs[key.symbol] = key.id
    }
    if (defaultsIds[key.symbol] == null) {
      defaultsIds[key.symbol] = key.id
    }
  }
  console.log(edgeIDs, '\n', defaultsIds)
}

coinmarketcapIsDumb()
