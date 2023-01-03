const fetch = require('node-fetch')
const json = require('../src/utils/currencyCodeMaps.json')

// Add list of all currency codes here
const appCurrencyCodeList = [
  'BTC',
  'BCH',
  'XMR',
  'ETH',
  'ZEC',
  'TRX',
  'DOT',
  'ETC',
  'BNB',
  'SOL',
  'BSV',
  'LTC',
  'EOS',
  'XRP',
  'RBTC',
  'XLM',
  'DASH',
  'XTZ',
  'DGB',
  'VTC',
  'RVN',
  'ARRR',
  'QTUM',
  'FTC',
  'BTG',
  'SMART',
  'GRS',
  'FIRO',
  'UFO',
  'TLOS',
  'WAX',
  'FTM',
  'HBAR',
  'MATIC',
  'AVAX',
  'TESTBTC',
  'CELO',
  'DOGE',
  'EBST',
  'ETHW',
  'FIO',
  'PNG',
  'PEFI',
  'XAVA',
  'BIFI',
  'YAK',
  'JOE',
  'FXS',
  'BUSD.E',
  'DAI.E',
  'LINK.E',
  'UNI.E',
  'USDC',
  'USDC.E',
  'USDT.E',
  'WBTC.E',
  'CUSD',
  'CEUR',
  '1INCH',
  'AAVE',
  'ABAT',
  'ADAI',
  'AKNC',
  'ALINK',
  'AMANA',
  'AMKR',
  'AMPL',
  'ANT',
  'ANTV1',
  'AREN',
  'ASNX',
  'ASUSD',
  'AUNI',
  'AUSDC',
  'AUSDT',
  'AWBTC',
  'AWETH',
  'AYFI',
  'AZRX',
  'BADGER',
  'BAL',
  'BAND',
  'BAT',
  'BNT',
  'BRZ',
  'CBAT',
  'CDAI',
  'CETH',
  'COMBO',
  'COMP',
  'CREAM',
  'CREP',
  'CRV',
  'CSAI',
  'CUSDC',
  'CVP',
  'CWBTC',
  'CZRX',
  'DAI',
  'DOUGH',
  'DPI',
  'ETHBNT',
  'FUN',
  'GLM',
  'GNO',
  'GNT',
  'GUSD',
  'HERC',
  'HUR',
  'IDLE',
  'IND',
  'INDEX',
  'KIN',
  'KNCV1',
  'KNC',
  'LINK',
  'MANA',
  'MET',
  'MKR',
  'NEXO',
  'NMR',
  'NOW',
  'NXM',
  'OCEAN',
  'OGN',
  'OMG',
  'OXT',
  'PICKLE',
  'POLY',
  'REN',
  'RENBCH',
  'RENBTC',
  'RENZEC',
  'REP',
  'REPV2',
  'ROOK',
  'SAI',
  'SALT',
  'SBTC',
  'SNX',
  'STORJ',
  'SUSD',
  'SUSHI',
  'TBTC',
  'TUSD',
  'UMA',
  'UNI',
  'USDP',
  'USDS',
  'USDT',
  'WBTC',
  'WETH',
  'WINGS',
  'YETI',
  'YFI',
  'ZRX',
  'BOO',
  'FBTC',
  'FETH',
  'FUSD',
  'FUSDT',
  'L3USD',
  'LIF3',
  'LSHARE',
  'MAI',
  'MIM',
  'TBOND',
  'TOMB',
  'TREEB',
  'TSHARE',
  'WFTM',
  'XBOO',
  'ZOO',
  'BUSD',
  'RIF',
  'USDD',
  'WTRX',
  'BTT',
  'JST',
  'WIN',
  'NFT',
  'SUN',
  'USDJ'
]

const currencyCodes = appCurrencyCodeList.map(code => code.toUpperCase())

const makeList = map =>
  Object.keys(map).map(cc => cc.split('_iso:')[0].toUpperCase())

const constants = makeList(json.constantCurrencyCodes)
const zeros = makeList(json.zeroRates)
const madeUpCodes = ['TESTBTC', 'KNCV1', 'ANTV1', 'REPV2']
const avaxWrappedCodes = [
  'BUSD.E',
  'DAI.E',
  'LINK.E',
  'UNI.E',
  'USDC.E',
  'USDT.E',
  'WBTC.E'
]
const compound = [
  'CREP',
  'CBAT',
  'CDAI',
  'CETH',
  'CSAI',
  'CUSDC',
  'CWBTC',
  'CZRX'
]

const ignoredCodes = [
  ...constants,
  ...zeros,
  ...madeUpCodes,
  ...avaxWrappedCodes,
  ...compound
]

const allEdgeCurrencies = () => {
  // Codes we can remove from rates engine
  const extraCodes = []
  for (const currCode of json.allEdgeCurrencies) {
    if (!currencyCodes.includes(currCode)) {
      extraCodes.push(currCode)
    }
  }
  console.log('Assets we can remove from allEdgeCurrencies:')

  // Codes we need to add to rates engine
  const allEdgeCurrenciesMissing = []
  for (const currCode of currencyCodes) {
    if (
      !json.allEdgeCurrencies.includes(currCode) &&
      !ignoredCodes.includes(currCode)
    ) {
      allEdgeCurrenciesMissing.push(currCode)
    }
  }
  console.log(
    'App assets missing from allEdgeCurrencies list:\n',
    allEdgeCurrenciesMissing
  )
}

// Gather all uids from coincap and make sure ours
const testCoincapUids = async () => {
  let assets = []
  const limit = 2000
  let offset = 0

  while (true) {
    console.log('Coincap fetching with offset', offset)
    try {
      const res = await fetch(
        `https://api.coincap.io/v2/assets?limit=${limit}&offset=${offset}`
      )
      if (!res.status) {
        const text = await res.text()
        console.log('failure: ', text)
        continue
      }
      const json = await res.json()
      assets = [...assets, ...json.data]
      offset += limit
      if (json.data.length < limit) break
    } catch (e) {}
  }
  console.log('Coincap done fetching')
  const coincapMismatchedCodes = []
  const coincapUnrecognizedUids = []
  for (const [code, uid] of Object.entries(json.coincap)) {
    const asset = assets.find(asset => asset.id === uid)
    if (asset != null) {
      if (asset.symbol !== code) {
        coincapMismatchedCodes.push([code, uid])
      }
    } else {
      coincapUnrecognizedUids.push(uid)
    }
  }
  console.log('Coincap code mismatches:', coincapMismatchedCodes)
  console.log('Coincap unrecognized UIDs:', coincapUnrecognizedUids)
}

const missingUids = () => {
  const coincap = makeList(json.coincap)
  const coincapMissingList = []
  const coinMarketCap = makeList(json.coinMarketCap)
  const coinMarketCapMissingList = []
  const coingecko = makeList(json.coingecko)
  const coingeckoMissingList = []

  const filteredCurrencyCodes = currencyCodes.filter(
    code => !ignoredCodes.includes(code)
  )

  for (const code of filteredCurrencyCodes) {
    if (!coincap.includes(code)) {
      coincapMissingList.push(code)
    }
    if (!coinMarketCap.includes(code)) {
      coinMarketCapMissingList.push(code)
    }
    if (!coingecko.includes(code)) {
      coingeckoMissingList.push(code)
    }
  }
  console.log('coincap missing codes: ', coincapMissingList)
  console.log('coinMarketCap missing codes: ', coinMarketCapMissingList)
  console.log('coingecko missing codes: ', coingeckoMissingList)
}

const audit = async () => {
  allEdgeCurrencies()
  missingUids()
  await testCoincapUids()
}

audit()
