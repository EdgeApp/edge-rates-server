import { bns } from 'biggystring'
import { asObject, asOptional, asString } from 'cleaners'
import nano from 'nano'

import { coincap } from './coincap'
// import { coincapHistorical } from './coincap'
import { coinMarketCapHistorical } from './coinMarketCap'
import { coinMarketCapCurrent } from './coinMarketCapBasic'
import { compound } from './compound'
import { config } from './config'
import { currencyConverter } from './currencyConverter'
import { getFromDb, saveToDb } from './dbUtils'
import { nomics } from './nomics'
import { openExchangeRates } from './openExchangeRates'
// import { asExchangeRatesReq } from './index'
import { normalizeDate } from './utils'

const { bridgeCurrencies } = config

const zeroRateCurrencyCodes = {
  UFO: true,
  FORK: true
}

const constantCurrencyCodes = {
  WETH: 'ETH',
  WBTC: 'BTC',
  AYFI: 'YFI',
  ALINK: 'LINK',
  ADAI: 'DAI',
  ABAT: 'BAT',
  AWETH: 'WETH',
  AWBTC: 'WBTC',
  ASNX: 'SNX',
  AREN: 'REN',
  AUSDT: 'USDT',
  AMKR: 'MKR',
  AMANA: 'MANA',
  AZRX: 'ZRX',
  AKNC: 'KNC',
  AUSDC: 'USDC',
  ASUSD: 'SUSD',
  AUNI: 'UNI',
  ANT: 'ANTV1',
  REPV2: 'REP'
}

const fallbackConstantRatePairs = {
  SAI_USD: '1',
  DAI_USD: '1',
  TESTBTC_USD: '0.01',
  BRZ_BRL: '1'
}

type ErrorType = 'not_found' | 'conflict' | 'db_error'
interface RateError extends Error {
  errorCode?: number
  errorType?: ErrorType
}

// const rateError = (
//   message: string,
//   errorCode: number = 500,
//   errorType?: ErrorType
// ): RateError => Object.assign(new Error(message), { errorCode, errorType })

export interface DbDoc extends nano.DocumentGetResponse {
  [pair: string]: any
  updated?: boolean
}

export interface ReturnGetRate {
  data: ReturnRate[]
  documents: DbDoc[]
}

interface ReturnRateUserResponse {
  currency_pair: string
  date: string
  exchangeRate: string | null
  error?: Error
}
export interface ReturnRate {
  data: ReturnRateUserResponse
}

export interface NewRates {
  [date: string]: { [pair: string]: string }
}

const getNullRateArray = (rates: ReturnRate[]): ReturnRate[] => {
  return rates.filter(rate => rate.data.exchangeRate === null)
}

const haveEveryRate = (rates: ReturnRate[]): boolean => {
  return rates.every(rate => rate.data.exchangeRate !== null)
}

const invertPair = (pair: string): string => {
  const fromCurrency = pair.split('_')[0]
  const toCurrency = pair.split('_')[1]
  return `${toCurrency}_${fromCurrency}`
}

const zeroRates = (rateObj: ReturnRate[]): NewRates => {
  const rates = {}
  for (const pair of rateObj) {
    if (
      zeroRateCurrencyCodes[pair.data.currency_pair.split('_')[0]] === true ||
      zeroRateCurrencyCodes[pair.data.currency_pair.split('_')[1]] === true
    ) {
      if (rates[pair.data.date] == null) {
        rates[pair.data.date] = {}
      }
      rates[pair.data.date][pair.data.currency_pair] = '0'
    }
  }
  return rates
}

const fallbackConstantRates = (rateObj: ReturnRate[]): NewRates => {
  const rates = {}
  for (const pair of rateObj) {
    if (fallbackConstantRatePairs[pair.data.currency_pair] != null) {
      if (rates[pair.data.date] == null) {
        rates[pair.data.date] = {}
      }
      rates[pair.data.date][pair.data.currency_pair] = '0'
    }
    if (
      fallbackConstantRatePairs[invertPair(pair.data.currency_pair)] != null
    ) {
      if (rates[pair.data.date] == null) {
        rates[pair.data.date] = {}
      }
      rates[pair.data.date][pair.data.currency_pair] = '0'
    }
  }
  return rates
}

const addNewRatesToDocs = (
  newRates: NewRates,
  rateObj: ReturnGetRate
): void => {
  for (const date of Object.keys(newRates)) {
    const dbIndex = rateObj.documents.findIndex(doc => doc._id === date)
    for (const pair of Object.keys(newRates[date])) {
      if (
        rateObj.documents[dbIndex] != null &&
        rateObj.documents[dbIndex][pair] == null
      ) {
        rateObj.documents[dbIndex][pair] = newRates[date][pair]
        rateObj.documents[dbIndex].updated = true
      }
    }
  }
}

const getRate = async (
  rateObj: ReturnGetRate,
  log: Function
): Promise<ReturnGetRate> => {
  const currentTime = normalizeDate(new Date().toISOString())
  if (typeof currentTime !== 'string') throw new Error('malformed date')

  // Retrieve new rates
  const rateProviders = [
    zeroRates,
    currencyConverter,
    openExchangeRates,
    coinMarketCapCurrent,
    coincap,
    coinMarketCapHistorical,
    nomics,
    compound,
    fallbackConstantRates
  ]

  for (const provider of rateProviders) {
    addNewRatesToDocs(
      await provider(getNullRateArray(rateObj.data), log, currentTime),
      rateObj
    )
    currencyBridgeDB(rateObj)
    if (haveEveryRate(rateObj.data)) break
  }

  return rateObj
}

export const getExchangeRate = async (
  query: Array<ReturnType<typeof asExchangeRateReq>>,
  localDb: any
): Promise<ReturnGetRate> => {
  try {
    const data = query.map(pair => {
      const { currencyPair, date } = asRateParam(pair)
      return {
        data: {
          currency_pair: currencyPair,
          date,
          exchangeRate: null
        }
      }
    })
    const documents: DbDoc[] = []
    const rateObj = { data, documents }

    const log = (...args): void => {
      console.log(`${JSON.stringify(args)}`)
      // const d = new Date().toISOString()
      // const p = currencyPair
      // console.log(`${d} ${p} ${JSON.stringify(args)}`)
    }
    await getFromDb(localDb, rateObj, log)
    const out = await getRate(rateObj, log)
    saveToDb(localDb, out.documents, log)
    return out
  } catch (e) {
    return {
      data: [
        {
          data: {
            // TODO: fix return type
            currency_pair: '',
            date: '',
            exchangeRate: '',
            error: e
          }
        }
      ],
      documents: []
    }
  }
}

export const currencyBridgeDB = (rateObj: ReturnGetRate): void => {
  for (let i = 0; i < rateObj.data.length; i++) {
    const rate = rateObj.data[i].data
    if (rate.exchangeRate !== null) continue
    const safeRequestedFrom = checkConstantCode(
      rate.currency_pair.split('_')[0]
    )
    const safeRequestedTo = checkConstantCode(rate.currency_pair.split('_')[1])
    const dbIndex = rateObj.documents.findIndex(doc => doc._id === rate.date)
    if (rateObj.documents[dbIndex] == null) continue
    // Check simple combinations first
    if (
      rateObj.documents[dbIndex][`${safeRequestedFrom}_${safeRequestedTo}`] !=
      null
    ) {
      rate.exchangeRate =
        rateObj.documents[dbIndex][`${safeRequestedFrom}_${safeRequestedTo}`]
      continue
    }
    if (
      rateObj.documents[dbIndex][`${safeRequestedTo}_${safeRequestedFrom}`] !=
      null
    ) {
      rate.exchangeRate = bns.div(
        '1',
        rateObj.documents[dbIndex][`${safeRequestedTo}_${safeRequestedFrom}`]
      )
      continue
    }

    // Try using bridge currencies to connect two different rates
    for (const bridgeCurrency of bridgeCurrencies) {
      if (
        safeRequestedFrom === bridgeCurrency ||
        safeRequestedTo === bridgeCurrency
      ) {
        continue
      }
      if (
        rateObj.documents[dbIndex][`${safeRequestedFrom}_${bridgeCurrency}`] !=
          null &&
        rateObj.documents[dbIndex][`${safeRequestedTo}_${bridgeCurrency}`] !=
          null
      ) {
        rate.exchangeRate = bns.div(
          rateObj.documents[dbIndex][`${safeRequestedFrom}_${bridgeCurrency}`],
          rateObj.documents[dbIndex][`${safeRequestedTo}_${bridgeCurrency}`]
        )
        continue
      }
      if (
        rateObj.documents[dbIndex][`${bridgeCurrency}_${safeRequestedFrom}`] !=
          null &&
        rateObj.documents[dbIndex][`${bridgeCurrency}_${safeRequestedTo}`] !=
          null
      ) {
        rate.exchangeRate = bns.div(
          rateObj.documents[dbIndex][`${bridgeCurrency}_${safeRequestedTo}`],
          rateObj.documents[dbIndex][`${bridgeCurrency}_${safeRequestedFrom}`]
        )
        continue
      }
      if (
        rateObj.documents[dbIndex][`${safeRequestedFrom}_${bridgeCurrency}`] !=
          null &&
        rateObj.documents[dbIndex][`${bridgeCurrency}_${safeRequestedTo}`] !=
          null
      ) {
        rate.exchangeRate = bns.mul(
          rateObj.documents[dbIndex][`${safeRequestedFrom}_${bridgeCurrency}`],
          rateObj.documents[dbIndex][`${bridgeCurrency}_${safeRequestedTo}`]
        )
        continue
      }

      if (
        rateObj.documents[dbIndex][`${bridgeCurrency}_${safeRequestedFrom}`] !=
          null &&
        rateObj.documents[dbIndex][`${safeRequestedTo}_${bridgeCurrency}`] !=
          null
      )
        rate.exchangeRate = bns.div(
          '1',
          bns.mul(
            rateObj.documents[dbIndex][
              `${bridgeCurrency}_${safeRequestedFrom}`
            ],
            rateObj.documents[dbIndex][`${safeRequestedTo}_${bridgeCurrency}`]
          )
        )
    }
  }
}

export const checkConstantCode = (code: string): string => {
  const constantCodes = constantCurrencyCodes
  const getConstantCode = (): string => {
    if (constantCodes[code] != null) {
      return constantCodes[code]
    }
    return code
  }
  return getConstantCode()
}

export const asExchangeRateReq = asObject({
  currency_pair: asString,
  date: asOptional(asString)
})

interface RateParamReturn {
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
    const parsedDate = normalizeDate(dateStr)
    if (parsedDate == null) {
      throw new Error(
        'date query param malformed.  should be conventional date string, ex:"2019-11-21T15:28:21.123Z"'
      )
    }
    if (Date.parse(parsedDate) > Date.now()) {
      throw new Error('Future date received. Must send past date.')
    }
    return { currencyPair, date: parsedDate }
  } catch (e) {
    e.errorCode = 400
    throw e
  }
}
