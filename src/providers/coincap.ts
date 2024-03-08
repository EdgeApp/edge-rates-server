import { asArray, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { AssetMap, NewRates, ReturnRate } from '../rates'
import {
  assetMapReducer,
  combineRates,
  createReducedRateMapArray,
  fromCode,
  fromCryptoToFiatCurrencyPair,
  isIsoCode,
  logger,
  snooze
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

const createUniqueIdString = (
  requestedCodes: string[],
  codeMap: AssetMap
): string => {
  return requestedCodes
    .filter(code => codeMap[code] != null)
    .map(code => codeMap[code])
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
): string => fromCryptoToFiatCurrencyPair(code.symbol.toUpperCase(), 'USD')

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
  codes: string[],
  assetMap: AssetMap
): Promise<NewRates> => {
  const rates = { [date]: {} }
  const codeString = createUniqueIdString(codes, assetMap)
  if (codeString === '') return rates
  const url = `${uri}/v2/assets?ids=${codeString}`
  try {
    const response = await fetch(url, OPTIONS)
    const json = asCoincapCurrentResponse(await response.json())
    if (response.ok === false) {
      const text = await response.text()
      logger(
        `coincapCurrent returned code ${response.status} for ${codes} at ${date}: ${text}`
      )
      throw new Error(text)
    }

    // Add to return object
    rates[date] = coincapCurrentRateMap(json.data)
  } catch (e) {
    logger('No coincapCurrent quote:', e)
  }

  return rates
}

const historicalQuery = async (
  date: string,
  code: string,
  assetMap: AssetMap
): Promise<NewRates> => {
  const rates: NewRates = { [date]: {} }
  const timestamp = Date.parse(date)
  const id = createUniqueIdString([code], assetMap)
  if (id === '') return rates
  try {
    const response = await fetch(
      `${uri}/v2/assets/${id}/history?interval=m1&start=${timestamp}&end=${timestamp +
        ONE_MINUTE}`,
      OPTIONS
    )
    if (response.ok === false) {
      const text = await response.text()
      logger(
        `coincapHistorical returned code ${response.status.toString()} for ${id} at ${date}: ${text}`
      )
      throw new Error(text)
    }
    const json = asCoincapHistoricalResponse(await response.json())
    if (json.data.length === 0)
      throw new Error(
        `Empty response for ${id}. Check if coincap still supports this asset and remove UID if necessary.`
      )

    // Add to return object
    rates[date][fromCryptoToFiatCurrencyPair(code, 'USD')] =
      json.data[0].priceUsd
  } catch (e) {
    logger('No coincapHistorical quote:', e)
  }
  return rates
}

export const coincap = async (
  rateObj: ReturnRate[],
  currentTime: string,
  edgeAssetMap: AssetMap
): Promise<NewRates> => {
  const rates = {}

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    if (datesAndCodesWanted[pair.date] == null) {
      datesAndCodesWanted[pair.date] = []
    }
    const fromCurrency = fromCode(pair.currency_pair)
    if (!isIsoCode(fromCurrency)) {
      datesAndCodesWanted[pair.date].push(fromCurrency)
    }
  }

  // Query
  const providers: Array<Promise<NewRates>> = []
  Object.keys(datesAndCodesWanted).forEach(date => {
    if (date === currentTime) {
      providers.push(
        currentQuery(date, datesAndCodesWanted[date], edgeAssetMap)
      )
    } else {
      datesAndCodesWanted[date].forEach(code => {
        providers.push(historicalQuery(date, code, edgeAssetMap))
      })
    }
  })
  try {
    const response = await Promise.all(providers)
    combineRates(rates, response)
  } catch (e) {
    logger('Failed to query coincap with error', e)
  }

  return rates
}

const asCoincapAssetResponse = asObject({
  data: asArray(asObject({ id: asString, symbol: asString }))
})

export const coincapAssets = async (): Promise<AssetMap> => {
  while (true) {
    const response = await fetch(`${uri}/v2/assets?limit=2000`)
    if (response.status === 429) {
      await snooze(1000) // rate limits reset every minute
      continue // retry
    }
    if (response.ok === false) {
      const text = await response.text()
      throw new Error(text)
    }
    return assetMapReducer(asCoincapAssetResponse(await response.json()).data)
  }
}
