import { asArray, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { AssetMap, NewRates, RateMap, ReturnRate } from '../rates'
import { coincap as coincapIds } from '../utils/currencyCodeMaps.json'
import {
  checkConstantCode,
  combineRates,
  isFiatCode,
  logger
} from './../utils/utils'

/*
// Coincap only returns USD denominated exchange rates
*/

const { uri } = config.providers.coincap

const ONE_MINUTE = 1000 * 60
const OPTIONS = {
  method: 'GET',
  json: true
}
const CODE_MAP = { ...coincapIds }

const createUniqueIdString = (requestedCodes: string[]): string => {
  return requestedCodes
    .filter(code => CODE_MAP[code] != null)
    .map(code => CODE_MAP[code])
    .join(',')
}

const asCoincapCurrentResponse = asObject({
  data: asArray(asObject({ symbol: asString, priceUsd: asString }))
})

const asCoincapHistoricalResponse = asObject({
  data: asArray(asObject({ priceUsd: asString }))
})

const coinCapCurrentRateMap = (
  results: ReturnType<typeof asCoincapCurrentResponse>
): RateMap =>
  results.data.reduce((out, code) => {
    return {
      ...out,
      [`${code.symbol}_iso:USD`]: code.priceUsd
    }
  }, {})

const currentQuery = async (
  date: string,
  codes: string[]
): Promise<NewRates> => {
  const rates = { [date]: {} }
  const codeString = createUniqueIdString(codes)
  if (codeString === '') return rates
  const url = `${uri}/v2/assets?ids=${codeString}`
  try {
    const response = await fetch(url, OPTIONS)
    const json = asCoincapCurrentResponse(await response.json())
    if (response.ok === false) {
      logger(
        `coincapCurrent returned code ${response.status} for ${codes} at ${date}`
      )
      throw new Error(response.status)
    }

    // Add to return object
    rates[date] = coinCapCurrentRateMap(json)
  } catch (e) {
    logger(`No coincapCurrent quote: ${JSON.stringify(e)}`)
  }

  return rates
}

const historicalQuery = async (
  date: string,
  code: string
): Promise<NewRates> => {
  const rates = { [date]: {} }
  const timestamp = Date.parse(date)
  const id = createUniqueIdString([code])
  if (id === '') return rates
  try {
    const response = await fetch(
      `${uri}/v2/assets/${id}/history?interval=m1&start=${timestamp}&end=${timestamp +
        ONE_MINUTE}`,
      OPTIONS
    )
    const json = asCoincapHistoricalResponse(await response.json())
    if (response.ok === false) {
      logger(
        `coincapHistorical returned code ${response.status} for ${id} at ${date}`
      )
      throw new Error(response.status)
    }

    // Add to return object
    rates[date][`${code}_iso:USD`] = json.data[0].priceUsd
  } catch (e) {
    logger(`No coincapHistorical quote: ${JSON.stringify(e)}`)
  }
  return rates
}

export const coincap = async (
  rateObj: ReturnRate[],
  currentTime: string
): Promise<NewRates> => {
  const rates = {}

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    if (datesAndCodesWanted[pair.date] == null) {
      datesAndCodesWanted[pair.date] = []
    }
    const fromCurrency = checkConstantCode(pair.currency_pair.split('_')[0])
    if (!isFiatCode(fromCurrency)) {
      datesAndCodesWanted[pair.date].push(fromCurrency)
    }
  }

  // Query
  const providers: Array<Promise<NewRates>> = []
  Object.keys(datesAndCodesWanted).forEach(date => {
    if (date === currentTime) {
      providers.push(currentQuery(date, datesAndCodesWanted[date]))
    } else {
      datesAndCodesWanted[date].forEach(code => {
        providers.push(historicalQuery(date, code))
      })
    }
  })
  try {
    const response = await Promise.all(providers)
    combineRates(rates, response)
  } catch (e) {
    logger('Failed to query coincap with error', e.message)
  }

  return rates
}

const asCoincapAssetResponse = asObject({
  data: asArray(asObject({ id: asString, symbol: asString }))
})

export const coincapAssets = async (): Promise<AssetMap> => {
  const assets: { [code: string]: string } = {}
  const response = await fetch('https://api.coincap.io/v2/assets?limit=2000')
  if (response.ok === false) {
    throw new Error(response.status)
  }
  const json = asCoincapAssetResponse(await response.json()).data

  for (const obj of json) {
    if (assets[obj.symbol] == null) assets[obj.symbol] = obj.id
  }

  return assets
}
