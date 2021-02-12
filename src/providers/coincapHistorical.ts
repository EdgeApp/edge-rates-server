import AwaitLock from 'async-lock'
import { asArray, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import CONFIG from '../../serverConfig.json'
import { RateParams } from '../../src/types'
import { ProviderFetch } from '../types'
import { log } from '../utils'

interface AssetMap {
  [assetSymbol: string]: string
}

const { url: coinCapUrl } = CONFIG.coincapHistorical

const FIVE_MINUTES = 300000 // milliseconds
const SEVEN_DAYS = 604800000
const JULY_1ST_2020: number = 1593561600000
const lock = new AwaitLock()

const asCoincapResponse = asObject({
  data: asArray(asObject({ priceUsd: asString }))
})

const asCoincapUpdateAssetsResponse = asObject({
  data: asArray(asObject({ id: asString, symbol: asString }))
})

const updateAssets = (
  assetMap: AssetMap = {},
  lastAssetUpdate: number = JULY_1ST_2020,
  url: string = `${coinCapUrl}?limit=2000`
) => async ({ currencyPair }: RateParams): Promise<AssetMap> => {
  await lock.acquireAsync()

  try {
    if (Date.now() - lastAssetUpdate < SEVEN_DAYS) throw new Error('too soon')

    log('CoincapHistorical is updating')

    const result = await fetch(url, { method: 'GET', json: true })
    const jsonObj = await result.json()

    if (result.ok === false || jsonObj.error != null) {
      throw new Error(
        `CoincapHistorical returned code ${jsonObj.error ?? result.status}`
      )
    }

    const newAssets = asCoincapUpdateAssetsResponse(jsonObj).data.reduce(
      (assets, { symbol, id }) => ({ ...assets, [symbol]: id }),
      {}
    )
    lastAssetUpdate = Date.now()
    assetMap = newAssets
    log('Updated CoincapHistorical asset list successfully')
  } catch (e) {
    if (e.message !== 'too soon') {
      log(
        'ERROR',
        `currencyPair: ${currencyPair}`,
        'No CoincapHistorical assets',
        e.message
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

  const { currencyA, currencyB, currencyPair, date } = rateParams
  if (currencyB !== 'USD' || assets[currencyA] == null) return

  try {
    const timestamp = Date.parse(date)
    const url = `${coinCapUrl}/${currencyA}/history?interval=m5&start=${timestamp}&end=${timestamp +
      FIVE_MINUTES}`

    const result = await fetch(url, { method: 'GET', json: true })
    const jsonObj = await result.json()

    if (result.ok === false || jsonObj.error != null) {
      throw new Error(
        `CoincapHistorical returned code ${jsonObj.error ?? result.status}`
      )
    }

    const rate = asCoincapResponse(jsonObj)
    if (rate.data.length > 0) return rate.data[0].priceUsd
  } catch (e) {
    log(
      'ERROR',
      `currencyPair: ${currencyPair}`,
      'No CoincapHistorical quote',
      e.message
    )
  }
}
