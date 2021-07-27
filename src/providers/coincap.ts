import { asArray, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { NewRates, ReturnRate } from '../rates'
import { coincap as coincapIds } from '../utils/currencyCodeMaps.json'
import {
  checkConstantCode,
  combineRates,
  createReducedRateMapArray,
  fromCode,
  fromCryptoToFiatCurrencyPair,
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

const asCoincapCurrentQuote = asObject({ symbol: asString, priceUsd: asString })

const asCoincapCurrentResponse = asObject({
  data: asArray(asCoincapCurrentQuote)
})

const coincapCurrentQuote = (
  code: ReturnType<typeof asCoincapCurrentQuote>
): string => code.priceUsd

const coinCapCurrentRatePair = (
  code: ReturnType<typeof asCoincapCurrentQuote>
): string => fromCryptoToFiatCurrencyPair(code.symbol, 'USD')

const coincapCurrentRateMap = createReducedRateMapArray(
  coinCapCurrentRatePair,
  coincapCurrentQuote
)

const asCoincapHistoricalQuote = asObject({ priceUsd: asString })

const asCoincapHistoricalResponse = asObject({
  data: asArray(asCoincapHistoricalQuote)
})

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
    rates[date] = coincapCurrentRateMap(json.data)
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
    rates[date][fromCryptoToFiatCurrencyPair(code, 'USD')] =
      json.data[0].priceUsd
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
    const fromCurrency = checkConstantCode(fromCode(pair.currency_pair))
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
