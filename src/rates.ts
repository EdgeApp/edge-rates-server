import { bns } from 'biggystring'
import { asObject, asOptional, asString } from 'cleaners'
import nano from 'nano'

import { config } from './config'
import { coincap } from './providers/coincap'
import { coinMarketCap } from './providers/coinMarketCap'
import { coinmonitor } from './providers/coinmonitor'
import { compound } from './providers/compound'
import { currencyConverter } from './providers/currencyConverter'
import {
  fallbackConstantRates,
  zeroRates
} from './providers/hardcodedProviders'
import { nomics } from './providers/nomics'
import { openExchangeRates } from './providers/openExchangeRates'
import { wazirx } from './providers/wazirx'
import { getFromDb, saveToDb } from './utils/dbUtils'
import {
  checkConstantCode,
  currencyCodeArray,
  fromCode,
  getNullRateArray,
  haveEveryRate,
  invertPair,
  isNotANumber,
  normalizeDate,
  toCode,
  toCurrencyPair
} from './utils/utils'

const { bridgeCurrencies } = config

const PRECISION = 20

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
    const dbIndex = documents.findIndex(doc => doc._id === date)
    if (dbIndex >= 0) {
      // Create map of inverted pairs and rates
      const rateMap = {}
      // const rateMap = newRates[date]
      for (const pair of Object.keys(newRates[date])) {
        const rate = Number(newRates[date][pair]).toFixed(PRECISION) // Prevent scientific notation
        // Sanity check value is acceptable and only allow a 0 rate from the zeroRates plugin
        if (
          isNotANumber(rate) ||
          (bns.eq(rate, '0') === true && providerName !== 'zeroRates')
        ) {
          continue
        }
        rateMap[pair] = rate
        rateMap[invertPair(pair)] =
          bns.eq(rate, '0') === true ? '0' : bns.div('1', rate, PRECISION)
      }

      // Add new rates and their inverts to the doc and mark updated
      documents[dbIndex] = {
        ...documents[dbIndex],
        ...rateMap,
        ...{ updated: true }
      }
    }
  }
}

const getRatesFromProviders = async (
  rateObj: ReturnGetRate
): Promise<ReturnGetRate> => {
  const currentTime = normalizeDate(new Date().toISOString())
  if (typeof currentTime !== 'string') throw new Error('malformed date')

  const assetMapDoc =
    rateObj.documents.find(doc => doc._id === 'currencyCodeMaps') ?? {}

  // Retrieve new rates
  const rateProviders = [
    zeroRates,
    coinmonitor,
    wazirx,
    coinMarketCap,
    coincap,
    nomics,
    compound,
    fallbackConstantRates,
    currencyConverter,
    openExchangeRates
  ]

  for (const provider of rateProviders) {
    addNewRatesToDocs(
      await provider(
        getNullRateArray(rateObj.data),
        currentTime,
        assetMapDoc[provider.name] ?? {}
      ),
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
  localDb: any
): Promise<ReturnGetRate> => {
  try {
    const docs: string[] = ['currencyCodeMaps']
    const data = query.map(pair => {
      const { currencyPair, date } = asRateParam(pair)
      if (!docs.includes(date)) docs.push(date)
      return {
        currency_pair: currencyPair,
        date,
        exchangeRate: null
      }
    })

    const documents: DbDoc[] = await getFromDb(localDb, docs)
    const out = await getRatesFromProviders({ data, documents })
    saveToDb(
      localDb,
      out.documents
        .filter(doc => doc.updated === true)
        .map(doc => {
          delete doc.updated
          return doc
        })
    )
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
  let constantCurrencyCodes = {}
  const currencyCodeMaps = rateObj.documents.find(
    doc => doc._id === 'currencyCodeMaps'
  )
  if (currencyCodeMaps?.constantCurrencyCodes != null)
    constantCurrencyCodes = currencyCodeMaps.constantCurrencyCodes
  for (let i = 0; i < rateObj.data.length; i++) {
    const rate = rateObj.data[i]
    if (rate.exchangeRate !== null) continue
    const dbIndex = rateObj.documents.findIndex(doc => doc._id === rate.date)
    if (rateObj.documents[dbIndex] == null) continue
    const from = checkConstantCode(
      fromCode(rate.currency_pair),
      constantCurrencyCodes
    )
    const to = checkConstantCode(
      toCode(rate.currency_pair),
      constantCurrencyCodes
    )
    const doc = rateObj.documents[dbIndex]
    // Check simple combinations first
    if (doc[toCurrencyPair(from, to)] != null) {
      rate.exchangeRate = doc[`${from}_${to}`]
      continue
    }

    // Try using bridge currencies to connect two different rates
    for (const bridgeCurrency of bridgeCurrencies) {
      if (from === bridgeCurrency || to === bridgeCurrency) {
        continue
      }
      if (
        doc[toCurrencyPair(from, bridgeCurrency)] != null &&
        doc[toCurrencyPair(to, bridgeCurrency)] != null
      ) {
        rate.exchangeRate = bns.div(
          doc[toCurrencyPair(from, bridgeCurrency)],
          doc[toCurrencyPair(to, bridgeCurrency)],
          PRECISION
        )
        continue
      }
      if (
        doc[toCurrencyPair(bridgeCurrency, from)] != null &&
        doc[toCurrencyPair(bridgeCurrency, to)] != null
      ) {
        rate.exchangeRate = bns.div(
          doc[toCurrencyPair(bridgeCurrency, to)],
          doc[toCurrencyPair(bridgeCurrency, from)],
          PRECISION
        )
        continue
      }
      if (
        doc[toCurrencyPair(from, bridgeCurrency)] != null &&
        doc[toCurrencyPair(bridgeCurrency, to)] != null
      ) {
        rate.exchangeRate = bns.mul(
          doc[toCurrencyPair(from, bridgeCurrency)],
          doc[toCurrencyPair(bridgeCurrency, to)]
        )
        continue
      }

      if (
        doc[toCurrencyPair(bridgeCurrency, from)] != null &&
        doc[toCurrencyPair(to, bridgeCurrency)] != null
      )
        rate.exchangeRate = bns.div(
          '1',
          bns.mul(
            doc[toCurrencyPair(bridgeCurrency, from)],
            doc[toCurrencyPair(to, bridgeCurrency)]
          ),
          PRECISION
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
    const currencyTokens = currencyCodeArray(currencyPair)
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
