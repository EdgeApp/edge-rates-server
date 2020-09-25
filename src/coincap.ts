import { bns } from 'biggystring'
import { asArray, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

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
  date: string,
  log: Function
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
      log(`coincap returned code ${result.status}`)
    }
    const jsonObj = await result.json()
    asCoincapResponse(jsonObj)
    if (jsonObj.data.length > 0) {
      return jsonObj.data[0].priceUsd
    }
  } catch (e) {
    log(`No coincap quote: ${JSON.stringify(e)}`)
  }
}

const coincapHistorical = async (
  currencyA: string,
  currencyB: string,
  date: string,
  log: Function
): Promise<string> => {
  if (Date.now() - lastAssetUpdate > SEVEN_DAYS) {
    console.log('assets need updating')
    assetMap = await updateAssets()
  }
  let rate = ''
  // Query coincap if USD is denominator
  if (currencyB === 'USD' && assetMap[currencyA] != null) {
    const response = await fetchQuote(assetMap[currencyA], date, log)
    if (response != null) rate = response
  } else if (currencyA === 'USD' && currencyB != null) {
    // Invert pair and rate if USD is the numerator
    const response = await fetchQuote(assetMap[currencyB], date, log)
    if (response != null) rate = bns.div('1', response, 8, 10)
  }
  return rate
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
