import { asObject, asOptional, asString } from 'cleaners'
import nano from 'nano'

import CONFIG from '../serverConfig.json'
import { coincapHistorical } from './providers/coincap'
import { coinFromDb } from './providers/coinFromDb'
import { coinMarketCapHistorical } from './providers/coinMarketCap'
import { coinMarketCapCurrent } from './providers/coinMarketCapBasic'
import { currencyConverter } from './providers/currencyConverter'
import { log, normalizeDate, postToSlack } from './utils'

const { bridgeCurrencies } = CONFIG

const zeroRateCurrencyCodes = {
  UFO: true,
  FORK: true
}

const fallbackConstantRatePairs = {
  SAI_USD: 1,
  DAI_USD: 1
}

type ErrorType = 'not_found' | 'conflict' | 'db_error'
interface RateError extends Error {
  errorCode?: number
  errorType?: ErrorType
}

const rateError = (
  message: string,
  errorCode: number = 500,
  errorType?: ErrorType
): RateError => Object.assign(new Error(message), { errorCode, errorType })

interface ReturnGetRate {
  rate?: string
  document?: any
  error?: RateError
}

const getRate = async (
  localDb: any,
  currencyA: string,
  currencyB: string,
  currencyPair: string,
  date: string
): Promise<ReturnGetRate> => {
  if (
    zeroRateCurrencyCodes[currencyA] === true ||
    zeroRateCurrencyCodes[currencyB] === true
  )
    return { rate: '0' }
  try {
    const dbRate = await coinFromDb(localDb, currencyA, currencyB, date)
    if (dbRate != null && dbRate !== '') return { rate: dbRate }

    let existingDocument = await localDb.get(date).catch(e => {
      if (e.error !== 'not_found') {
        log(`${currencyPair} does not exist for date: ${date}`)
      }
    })
    if (existingDocument == null) {
      existingDocument = {
        _id: date,
        [currencyPair]: ''
      }
    }

    await currencyBridge(
      async () => Promise.resolve(''),
      currencyA,
      currencyB,
      date,
      existingDocument
    )
    const dbBridge = existingDocument[currencyPair]
    if (dbBridge != null && dbBridge !== '')
      return { rate: dbBridge, document: existingDocument }

    const exchanges = [
      currencyConverter,
      coinMarketCapCurrent,
      coincapHistorical,
      coinMarketCapHistorical
    ]
    let bridge = ''
    for (const exchange of exchanges) {
      bridge = await exchange(currencyA, currencyB, date)
      if (bridge != null && bridge !== '') {
        existingDocument[currencyPair] = bridge
        break
      }

      await currencyBridge(
        exchange,
        currencyA,
        currencyB,
        date,
        existingDocument
      )

      bridge = existingDocument[currencyPair]
      if (bridge != null && bridge !== '') {
        break
      }
    }

    if (bridge != null && bridge !== '') {
      return { rate: bridge, document: existingDocument }
    }

    // Use fallback hardcoded rates if lookups failed
    if (fallbackConstantRatePairs[`${currencyA}_${currencyB}`] != null) {
      return { rate: fallbackConstantRatePairs[`${currencyA}_${currencyB}`] }
    }

    if (fallbackConstantRatePairs[`${currencyB}_${currencyA}`] != null) {
      return { rate: fallbackConstantRatePairs[`${currencyB}_${currencyA}`] }
    }

    const error = rateError(
      `RATES SERVER: All lookups failed to find exchange rate for currencypair ${currencyA}_${currencyB} at date ${date}.`,
      400,
      'not_found'
    )

    const requestedDateTimestamp = new Date(date).getTime()
    if (Date.now() - CONFIG.ratesLookbackLimit > requestedDateTimestamp) {
      existingDocument[currencyPair] = '0'
      return { document: existingDocument, error }
    }
    return { error }
  } catch (e) {
    if (e.errorCode === 400) throw e
    throw rateError(e.message, 500, 'db_error')
  }
}

interface ReturnRateUserResponse {
  currency_pair?: string
  date?: string
  exchangeRate?: string
}
export interface ReturnRate {
  data: ReturnRateUserResponse
  document?: any
  error?: Error
}

export const getExchangeRate = async (
  query: ReturnType<typeof asExchangeRateReq>,
  localDb: any
): Promise<ReturnRate> => {
  try {
    const { currencyA, currencyB, currencyPair, date } = asRateParam(query)
    const { rate, error, document } = await getRate(
      localDb,
      currencyA,
      currencyB,
      currencyPair,
      date
    )

    return {
      data: {
        currency_pair: currencyPair,
        date,
        exchangeRate: rate
      },
      error: error,
      document: document
    }
  } catch (e) {
    if (e.errorType === 'db_error') {
      postToSlack(
        new Date().toISOString(),
        `RATES SERVER: exchangeRate query failed for ${query.currency_pair} with error code ${e.errorCode}.  ${e.message}`
      ).catch(e)
    }
    return {
      data: {
        currency_pair: query.currency_pair
      },
      error: e
    }
  }
}

export type ProviderFetch = (
  currencyA: string,
  currencyB: string,
  date: string
) => Promise<string>

export const currencyBridge = async (
  getExchangeRate: ProviderFetch,
  currencyA: string,
  currencyB: string,
  date: string,
  currencyRates: nano.DocumentGetResponse
): Promise<void> => {
  for (const currency of bridgeCurrencies) {
    const pair1 = `${currencyA}_${currency}`
    const pair2 = `${currency}_${currencyB}`
    if (currencyA === currency || currencyB === currency) continue
    try {
      const currACurr =
        currencyRates[pair1] ??
        (await getExchangeRate(currencyA, currency, date))
      if (currACurr !== '') Object.assign(currencyRates, { [pair1]: currACurr })
      const currCurrB =
        currencyRates[pair2] ??
        (await getExchangeRate(currency, currencyB, date))
      if (currCurrB !== '') Object.assign(currencyRates, { [pair2]: currCurrB })
      if (currACurr !== '' && currCurrB !== '') {
        const rate = (parseFloat(currACurr) * parseFloat(currCurrB)).toString()
        Object.assign(currencyRates, { [`${currencyA}_${currencyB}`]: rate })
        return
      }
    } catch (e) {
      console.log(e)
    }
  }
}

export const asExchangeRateReq = asObject({
  currency_pair: asString,
  date: asOptional(asString)
})

interface RateParamReturn {
  currencyA: string
  currencyB: string
  currencyPair: string
  date: string
}

export const asRateParam = (param: any): RateParamReturn => {
  try {
    const { currency_pair: currencyPair, date } = asExchangeRateReq(param)
    let dateStr: string
    if (typeof date === 'string') {
      dateStr = date
    } else {
      dateStr = new Date().toISOString()
    }
    if (typeof currencyPair !== 'string' || typeof dateStr !== 'string') {
      throw new Error(
        'Missing or invalid query param(s): currency_pair and date should both be strings'
      )
    }
    const currencyTokens = currencyPair.split('_')
    if (currencyTokens.length !== 2) {
      throw new Error(
        'currency_pair query param malformed.  should be [curA]_[curB], ex: "ETH_USD"'
      )
    }
    const currencyA = currencyTokens[0]
    const currencyB = currencyTokens[1]
    const parsedDate = normalizeDate(dateStr)
    if (parsedDate == null) {
      throw new Error(
        'date query param malformed.  should be conventional date string, ex:"2019-11-21T15:28:21.123Z"'
      )
    }
    if (Date.parse(parsedDate) > Date.now()) {
      throw new Error('Future date received. Must send past date.')
    }
    return { currencyPair, currencyA, currencyB, date: parsedDate }
  } catch (e) {
    e.errorCode = 400
    throw e
  }
}
