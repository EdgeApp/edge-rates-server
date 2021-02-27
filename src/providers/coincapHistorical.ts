import AwaitLock from 'await-lock'
import { asArray, asNumber, asObject, asOptional, asString } from 'cleaners'
import fetch from 'node-fetch'

import { asMaybeString } from '../types/cleaners'
import { ProviderFetch, RateGetterParams } from '../types/types'
import { config } from '../utils/config'
import { logger } from '../utils/utils'

interface AssetMap {
  [assetSymbol: string]: string
}

const { url: coinCapUrl } = config.coincapHistorical

const FIVE_MINUTES = 300000 // milliseconds
const SEVEN_DAYS = 604800000
const JULY_1ST_2020: number = 1593561600000
const lock = new AwaitLock()

export const asCoincapError = asObject({
  error: asOptional(asString),
  timestamp: asNumber
})

export const asHistoricalQuote = asObject({
  priceUsd: asString,
  time: asNumber,
  circulatingSupply: asOptional(asString),
  date: asOptional(asString)
})

export const asAssetsQuote = asObject({
  id: asString,
  rank: asString,
  symbol: asString,
  name: asString,
  supply: asMaybeString,
  maxSupply: asMaybeString,
  marketCapUsd: asMaybeString,
  volumeUsd24Hr: asMaybeString,
  priceUsd: asMaybeString,
  changePercent24Hr: asMaybeString,
  vwap24Hr: asMaybeString,
  explorer: asMaybeString
})

export const asCoincapHistoricalData = asObject({
  data: asOptional(asArray(asHistoricalQuote))
})

export const asCoincapAssetsData = asObject({
  data: asArray(asAssetsQuote)
})

const updateAssets = (
  assetMap: AssetMap = {},
  lastAssetUpdate: number = JULY_1ST_2020,
  url: string = `${coinCapUrl}?limit=2000`
) => async (rateParams: RateGetterParams): Promise<AssetMap> => {
  await lock.acquireAsync()

  try {
    if (Date.now() - lastAssetUpdate < SEVEN_DAYS) throw new Error('too_soon')

    const result = await fetch(url, { method: 'GET', json: true })
    const jsonObj = await result.json()
    const { error } = asCoincapError(jsonObj)

    if ((error != null && error !== '') || result.ok === false) {
      throw new Error(
        `CoincapHistorical returned code ${JSON.stringify(
          error ?? result.status
        )}`
      )
    }

    const { data } = asCoincapAssetsData(jsonObj)
    const newAssets = data.reduce(
      (assets, { symbol, id }) => ({ ...assets, [symbol]: id }),
      {}
    )
    lastAssetUpdate = Date.now()
    assetMap = newAssets
    logger('Updated CoincapHistorical asset list successfully')
  } catch (e) {
    if (e.message !== 'too_soon') {
      logger(
        'ERROR',
        `url: ${url}`,
        'No CoincapHistorical assets',
        e,
        rateParams
      )
    }
  } finally {
    lock.release()
  }
  return assetMap
}

const assetMap = updateAssets()

export const coincapHistorical: ProviderFetch = async rateParams => {
  const assets = await assetMap(rateParams)

  const { currencyA, currencyB, date } = rateParams
  if (currencyB !== 'USD' || assets[currencyA] == null) return null
  const timestamp = Date.parse(date)
  const url = `${coinCapUrl}/${currencyA}/history?interval=m5&start=${timestamp}&end=${
    timestamp + FIVE_MINUTES
  }`

  try {
    const result = await fetch(url, { method: 'GET', json: true })
    const jsonObj = await result.json()
    const { error } = asCoincapError(jsonObj)

    if ((error != null && error !== '') || result.ok === false) {
      throw new Error(
        `CoincapHistorical returned code ${JSON.stringify(
          error ?? result.status
        )}`
      )
    }

    const { data } = asCoincapHistoricalData(jsonObj)
    if (data != null && data.length > 0) return data[0].priceUsd
  } catch (e) {
    logger('ERROR', `url: ${url}`, 'No CoincapHistorical quote', e, rateParams)
  }
  return null
}
