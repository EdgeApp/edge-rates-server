import { bns } from 'biggystring'
import { asObject, asOptional, asString } from 'cleaners'
import nano from 'nano'

import { config } from './config'
import { coincap } from './providers/coincap'
import { coinMarketCapHistorical } from './providers/coinMarketCap'
import { coinMarketCapCurrent } from './providers/coinMarketCapBasic'
import { compound } from './providers/compound'
import { currencyConverter } from './providers/currencyConverter'
import {
  fallbackConstantRates,
  zeroRates
} from './providers/hardcodedProviders'
import { nomics } from './providers/nomics'
import { openExchangeRates } from './providers/openExchangeRates'
import { DbDoc, getFromDb, saveToDb } from './utils/dbUtils'
import {
  checkConstantCode,
  getNullRateArray,
  haveEveryRate,
  invertPair,
  isNotANumber,
  normalizeDate
} from './utils/utils'

const { bridgeCurrencies } = config

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

export interface ReturnGetRate {
  data: ReturnRate[]
  documents: DbDoc[]
}

export interface ReturnRate {
  currency_pair: string
  date: string
  exchangeRate: string | null
  error?: Error
}

export interface RateMap {
  [pair: string]: string
}

export interface NewRates {
  [date: string]: RateMap
}

export interface AssetMap {
  [currencyCode: string]: string
}

const addNewRatesToDocs = (
  newRates: NewRates,
  documents: DbDoc[],
  providerName: string
): void => {
  for (const date of Object.keys(newRates)) {
    const rateMap = newRates[date]
    const dbIndex = documents.findIndex(doc => doc._id === date)
    if (dbIndex >= 0) {
      // Create map of inverted pairs and rates
      const invertedRateMap = {}
      for (const pair of Object.keys(rateMap)) {
        const rate = rateMap[pair]
        // Sanity check value is acceptable and only allow a 0 rate from the zeroRates plugin
        if (
          isNotANumber(rate) ||
          (rate === '0' && providerName !== 'zeroRates')
        ) {
          delete rateMap[pair]
          continue
        }
        invertedRateMap[invertPair(pair)] =
          rate === '0' ? '0' : bns.div('1', rate, 8)
      }

      // Add new rates and their inverts to the doc and mark updated
      documents[dbIndex] = {
        ...documents[dbIndex],
        ...rateMap,
        ...invertedRateMap,
        ...{ updated: true }
      }
    }
  }
}

const getRatesFromProviders = async (
  rateObj: ReturnGetRate,
  assetMaps: { [provider: string]: AssetMap }
): Promise<ReturnGetRate> => {
  const currentTime = normalizeDate(new Date().toISOString())
  if (typeof currentTime !== 'string') throw new Error('malformed date')

  // Retrieve new rates
  const rateProviders = [
    zeroRates,
    currencyConverter,
    coinMarketCapCurrent,
    coincap,
    coinMarketCapHistorical,
    nomics,
    compound,
    fallbackConstantRates,
    openExchangeRates
  ]

  for (const provider of rateProviders) {
    addNewRatesToDocs(
      await provider(getNullRateArray(rateObj.data), currentTime, assetMaps),
      rateObj.documents,
      provider.name
    )
    currencyBridgeDB(rateObj)
    if (haveEveryRate(rateObj.data)) break
  }

  return rateObj
}

export const getExchangeRates = async (
  query: Array<ReturnType<typeof asExchangeRateReq>>,
  localDb: nano.DocumentScope<DbDoc>,
  assetMaps: { [provider: string]: AssetMap }
): Promise<ReturnGetRate> => {
  try {
    const dates: string[] = []
    const data = query.map(pair => {
      const { currencyPair, date } = asRateParam(pair)
      if (!dates.includes(date)) dates.push(date)
      return {
        currency_pair: currencyPair,
        date,
        exchangeRate: null
      }
    })

    const documents: DbDoc[] = await getFromDb(localDb, dates)
    const out = await getRatesFromProviders({ data, documents }, assetMaps)
    saveToDb(localDb, out.documents)
    return out
  } catch (e) {
    return {
      data: [
        {
          currency_pair: '',
          date: '',
          exchangeRate: '',
          error: e
        }
      ],
      documents: []
    }
  }
}

export const currencyBridgeDB = (rateObj: ReturnGetRate): void => {
  for (let i = 0; i < rateObj.data.length; i++) {
    const rate = rateObj.data[i]
    if (rate.exchangeRate !== null) continue
    const dbIndex = rateObj.documents.findIndex(doc => doc._id === rate.date)
    if (rateObj.documents[dbIndex] == null) continue
    const from = checkConstantCode(rate.currency_pair.split('_')[0])
    const to = checkConstantCode(rate.currency_pair.split('_')[1])
    const doc = rateObj.documents[dbIndex]
    // Check simple combinations first
    if (doc[`${from}_${to}`] != null) {
      rate.exchangeRate = doc[`${from}_${to}`]
      continue
    }

    // Try using bridge currencies to connect two different rates
    for (const bridgeCurrency of bridgeCurrencies) {
      if (from === bridgeCurrency || to === bridgeCurrency) {
        continue
      }
      if (
        doc[`${from}_${bridgeCurrency}`] != null &&
        doc[`${to}_${bridgeCurrency}`] != null
      ) {
        rate.exchangeRate = bns.div(
          doc[`${from}_${bridgeCurrency}`],
          doc[`${to}_${bridgeCurrency}`],
          8
        )
        continue
      }
      if (
        doc[`${bridgeCurrency}_${from}`] != null &&
        doc[`${bridgeCurrency}_${to}`] != null
      ) {
        rate.exchangeRate = bns.div(
          doc[`${bridgeCurrency}_${to}`],
          doc[`${bridgeCurrency}_${from}`],
          8
        )
        continue
      }
      if (
        doc[`${from}_${bridgeCurrency}`] != null &&
        doc[`${bridgeCurrency}_${to}`] != null
      ) {
        rate.exchangeRate = bns.mul(
          doc[`${from}_${bridgeCurrency}`],
          doc[`${bridgeCurrency}_${to}`]
        )
        continue
      }

      if (
        doc[`${bridgeCurrency}_${from}`] != null &&
        doc[`${to}_${bridgeCurrency}`] != null
      )
        rate.exchangeRate = bns.div(
          '1',
          bns.mul(
            doc[`${bridgeCurrency}_${from}`],
            doc[`${to}_${bridgeCurrency}`]
          ),
          8
        )
    }
  }
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
        'currency_pair query param malformed.  should be [curA]_[curB], ex: "ETH_iso:USD"'
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
