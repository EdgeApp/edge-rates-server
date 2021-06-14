import { asArray, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { NewRates, ProviderResponse, ReturnRate } from '../rates'
import {
  coincapDefaultMap,
  coincapEdgeMap,
  fiatCurrencyCodes
} from '../utils/currencyCodeMaps'
import { checkConstantCode } from './../utils/utils'

const { coincapBaseUrl } = config

const ONE_MINUTE = 1000 * 60
const OPTIONS = {
  method: 'GET',
  json: true
}
const CODE_MAP = { ...coincapDefaultMap, ...coincapEdgeMap }

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

const currentQuery = async (
  date: string,
  codes: string[],
  log: Function
): Promise<ProviderResponse> => {
  const rates = { [date]: {} }
  const codeString = createUniqueIdString(codes)
  if (codeString === '') return rates
  const url = `${coincapBaseUrl}/v2/assets?ids=${codes}`
  try {
    const response = await fetch(url, OPTIONS)
    const json = asCoincapCurrentResponse(await response.json())
    if (response.ok === false) {
      log(
        `coincapCurrent returned code ${response.status} for ${codes} at ${date}`
      )
      throw new Error(response.status)
    }

    // Add to return object
    json.data.forEach(obj => {
      rates[date][`${obj.symbol}_USD`] = obj.priceUsd
    })
  } catch (e) {
    log(`No coincapCurrent quote: ${JSON.stringify(e)}`)
  }

  return rates
}

const historicalQuery = async (
  date: string,
  code: string,
  log: Function
): Promise<ProviderResponse> => {
  const rates = { [date]: {} }
  const timestamp = Date.parse(date)
  const id = createUniqueIdString([code])
  if (id === '') return rates
  try {
    const response = await fetch(
      `${coincapBaseUrl}/v2/assets/${id}/history?interval=m1&start=${timestamp}&end=${timestamp +
        ONE_MINUTE}`,
      OPTIONS
    )
    const json = asCoincapHistoricalResponse(await response.json())
    if (response.ok === false) {
      log(
        `coincapHistorical returned code ${response.status} for ${id} at ${date}`
      )
      throw new Error(response.status)
    }

    // Add to return object
    if (json.data.length > 0) {
      rates[date][`${code}_USD`] = json.data[0].priceUsd
    }
  } catch (e) {
    log(`No coincapHistorical quote: ${JSON.stringify(e)}`)
  }
  return rates
}

const coincap = async (
  rateObj: ReturnRate[],
  log: Function,
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
    if (fiatCurrencyCodes[fromCurrency] == null) {
      datesAndCodesWanted[pair.date].push(fromCurrency)
    }
  }

  // Query
  const providers: Array<Promise<ProviderResponse>> = []
  Object.keys(datesAndCodesWanted).forEach(date => {
    if (date === currentTime) {
      providers.push(currentQuery(date, datesAndCodesWanted[date], log))
    } else {
      datesAndCodesWanted[date].forEach(code => {
        providers.push(historicalQuery(date, code, log))
      })
    }
  })
  try {
    const response = await Promise.all(providers)
    Object.assign(
      rates,
      response.reduce((res, out) => ({ ...res, ...out }), {})
    )
  } catch (e) {
    log('Failed to query coincap with error', e.message)
  }

  return rates
}

export { coincap }
