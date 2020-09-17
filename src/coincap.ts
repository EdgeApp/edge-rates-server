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

const fetchQuote = async (
  currency: string,
  date: string
): Promise<string | void> => {
  const options = {
    method: 'GET',
    json: true
  }
  const timestamp = Date.parse(date)
  const url = `https://api.coincap.io/v2/assets/${currency}/history?interval=m5&start=${timestamp}&end=${timestamp +
    FIVE_MINUTES}`
  try {
    const result = await fetch(url, options)
    if (result.ok === false) {
      console.error(`coincap returned code ${result.status}`)
    }
    const jsonObj = await result.json()
    asCoincapResponse(jsonObj)
    if (jsonObj.data.length > 0) {
      return jsonObj.data[0].priceUsd
    }
  } catch (e) {
    console.error(`No coincap ${currency} quote: `, e)
  }
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
  // Check if either code is supported
  if (assetMap[currencyA] == null && assetMap[currencyB] == null) return
  // Check if none of the codes are USD
  if (currencyA !== 'USD' && currencyB !== 'USD') {
    return
  }
  // Check if both codes are USD
  if (currencyA === 'USD' && currencyB === 'USD') {
    return
  }
  // Query coincap if fiat is denominator
  let rate
  if (currencyB === 'USD') {
    rate = await fetchQuote(assetMap[currencyA], date)
  } else {
    // Invert pair and rate if fiat is the numerator
    rate = bns.div('1', await fetchQuote(assetMap[currencyB], date), 8, 10)
  }
  if (rate == null) return
  return {
    rate,
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
