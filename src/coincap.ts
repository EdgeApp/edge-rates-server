import { bns } from 'biggystring'
import { asArray, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { ExchangeResponse } from './index'

const FIVE_MINUTES = 300000 // milliseconds
const SEVEN_DAYS = 604800000

let lastAssetUpdate: number = 1593561600000 // July 1st, 2020
let assetMap = {}

const asCoincapResponse = asObject({
  data: asArray(asObject({ priceUsd: asString }))
})

const asCoincapUpdateAssetsResponse = asObject({
  data: asArray(asObject({ id: asString, symbol: asString }))
})

const fetchQuote = async (currency: string, date: string): Promise<string> => {
  const options = {
    method: 'GET',
    json: true
  }
  const asset = assetMap[currency]
  if (asset === undefined) {
    console.log(
      `coincap undefined asset ${currency}\nassetMap has ${
        Object.keys(assetMap).length
      } currencies`
    )
    return ''
  }
  const timestamp = Date.parse(date)
  const url = `https://api.coincap.io/v2/assets/${asset}/history?interval=m5&start=${timestamp}&end=${timestamp +
    FIVE_MINUTES}`
  console.log(url)
  try {
    const result = await fetch(url, options)
    if (result.ok === false) {
      console.error(`coincap returned code ${result.status}`)
    }
    const jsonObj = await result.json()
    asCoincapResponse(jsonObj)
    if (jsonObj.data.length > 0) {
      console.log(`coincap won`)
      return jsonObj.data[0].priceUsd
    }
  } catch (e) {
    console.error(`No coincap ${currency} quote: `, e)
  }
  return ''
}

const coincapHistorical = async (
  currencyA: string,
  currencyB: string,
  date: string
): Promise<ExchangeResponse> => {
  if (Date.now() - lastAssetUpdate > SEVEN_DAYS) {
    console.log('assets need updating')
    assetMap = await updateAssets()
  }
  const aToUsdRate = await fetchQuote(currencyA, date)
  if (aToUsdRate === '') {
    return
  }
  if (currencyB === 'USD') {
    return {
      rate: aToUsdRate,
      needsWrite: true
    }
  }
  const bToUsdRate = await fetchQuote(currencyB, date)
  if (bToUsdRate === '') {
    return
  }
  return {
    rate: bns.div(aToUsdRate, bToUsdRate, 8),
    needsWrite: true
  }
}

const updateAssets = async (): Promise<{ [key: string]: string }> => {
  const options = {
    method: 'GET',
    json: true
  }
  const url = 'https://api.coincap.io/v2/assets?limit=2000'
  const currentAssets = assetMap
  try {
    const result = await fetch(url, options)
    if (result.ok === false) {
      console.error(`coincap updateAssets returned code ${result.status}`)
    }
    const jsonObj = await result.json()
    asCoincapUpdateAssetsResponse(jsonObj)
    const newObj = {}
    jsonObj.data.forEach(element => {
      newObj[element.symbol] = element.id
    })
    lastAssetUpdate = Date.now()
    console.log('Updated coincap asset list successfully')
    return newObj
  } catch (e) {
    return currentAssets
  }
}

export { coincapHistorical }
