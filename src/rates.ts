import { div, eq, mul } from 'biggystring'
import {
  asArray,
  asEither,
  asNull,
  asObject,
  asOptional,
  asString
} from 'cleaners'
import nano from 'nano'

import { config } from './config'
import { asExchangeRateReq, ExchangeRateReq } from './exchangeRateRouter'
import { coincap } from './providers/coincap'
import { coingecko } from './providers/coingecko'
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
import { hgetallAsync, hsetAsync } from './uidEngine'
import {
  asDbDoc,
  DbDoc,
  getEdgeAssetDoc,
  getFromDb,
  saveToDb
} from './utils/dbUtils'
import {
  checkConstantCode,
  currencyCodeArray,
  fromCode,
  getNullRateArray,
  haveEveryRate,
  invertPair,
  isNotANumber,
  logger,
  normalizeDate,
  toCode,
  toCurrencyPair
} from './utils/utils'

const { bridgeCurrencies } = config

const PRECISION = 20

export interface ReturnGetRate {
  data: ReturnRate[]
  documents: DbDoc[]
}

export const asReturnGetRate = asObject({
  data: asArray(
    asObject<ReturnRate>({
      currency_pair: asString,
      date: asString,
      exchangeRate: asEither(asString, asNull),
      error: asOptional(asString)
    })
  ),
  documents: asArray(asDbDoc)
})

export interface ReturnRate {
  currency_pair: string
  date: string
  exchangeRate: string | null
  error?: string
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
    if (dbIndex === -1 || Object.keys(newRates[date]).length === 0) continue

    // Create map of inverted pairs and rates
    const rateMap = {}
    for (const pair of Object.keys(newRates[date])) {
      const rate = Number(newRates[date][pair]).toFixed(PRECISION) // Prevent scientific notation
      // Sanity check value is acceptable and only allow a 0 rate from the zeroRates plugin
      if (
        isNotANumber(rate) ||
        (eq(rate, '0') && providerName !== 'zeroRates')
      ) {
        continue
      }
      rateMap[pair] = rate
      rateMap[invertPair(pair)] = eq(rate, '0')
        ? '0'
        : div('1', rate, PRECISION)
    }

    // Add new rates and their inverts to the doc and mark updated
    documents[dbIndex] = {
      ...documents[dbIndex],
      ...rateMap,
      ...bridgeCurrencies.reduce(
        (out, code) => Object.assign(out, { [`${code}_${code}`]: '1' }),
        {}
      ),
      ...{ updated: true }
    }
  }
}

const getRatesFromProviders = async (
  rateObj: ReturnGetRate,
  edgeAssetMap: DbDoc
): Promise<ReturnGetRate> => {
  const currentTime = normalizeDate(new Date().toISOString())
  if (typeof currentTime !== 'string') throw new Error('malformed date')

  // Retrieve new rates
  const rateProviders = [
    zeroRates,
    coinmonitor,
    wazirx,
    coinMarketCap,
    coincap,
    coingecko,
    nomics,
    compound,
    fallbackConstantRates,
    currencyConverter,
    openExchangeRates
  ]

  let constantCurrencyCodes = await hgetallAsync('constantCurrencyCodes')
  if (constantCurrencyCodes == null)
    ({ constantCurrencyCodes = {} } = edgeAssetMap)

  for (const provider of rateProviders) {
    addNewRatesToDocs(
      await provider(
        getNullRateArray(rateObj.data),
        currentTime,
        (await hgetallAsync(provider.name)) ?? edgeAssetMap[provider.name] ?? {}
      ),
      rateObj.documents,
      provider.name
    )
    currencyBridgeDB(rateObj, constantCurrencyCodes)
    if (haveEveryRate(rateObj.data)) break
  }

  return rateObj
}

export const getExchangeRates = async (
  query: ExchangeRateReq[],
  localDb: nano.DocumentScope<DbDoc>
): Promise<ReturnGetRate> => {
  try {
    const docs: string[] = []
    const data = query.map(pair => {
      const { currency_pair, date } = asRateParam(pair)
      if (!docs.includes(date)) docs.push(date)
      return {
        currency_pair,
        date,
        exchangeRate: null
      }
    })

    const edgeAssetDoc = await getEdgeAssetDoc()
    const documents: DbDoc[] = await getFromDb(localDb, docs)

    const out = await getRatesFromProviders({ data, documents }, edgeAssetDoc)

    // Save rates to Redis
    for (const doc of out.documents) {
      const newRates = Object.keys(doc)
        .filter(pair => pair !== '_id' && pair !== '_rev' && pair !== 'updated')
        .map(pair => [pair, doc[pair]])
        .flat()
      // Fill in constant rates codes if we already found their equivalent
      for (const code of Object.keys(edgeAssetDoc.constantCurrencyCodes)) {
        if (
          newRates[`${code}_iso:USD`] == null &&
          newRates[`${edgeAssetDoc.constantCurrencyCodes[code]}_iso:USD`] !=
            null
        )
          newRates[`${code}_iso:USD`] =
            newRates[`${edgeAssetDoc.constantCurrencyCodes[code]}_iso:USD`]
      }
      // Add the zero rates, too
      for (const code of Object.keys(edgeAssetDoc.zeroRates)) {
        newRates[`${code}_iso:USD`] = '0'
      }
      // Compound assets
      for (const code of Object.keys(edgeAssetDoc.compound)) {
        if (
          newRates[`${code}_iso:USD`] == null &&
          newRates[`${edgeAssetDoc.constantCurrencyCodes[code]}_iso:USD`] !=
            null &&
          !eq(
            newRates[`${edgeAssetDoc.constantCurrencyCodes[code]}_iso:USD`],
            '0'
          )
        )
          newRates[`${code}_iso:USD`] = div(
            newRates[`${code}_${edgeAssetDoc.constantCurrencyCodes[code]}`],
            newRates[`${edgeAssetDoc.constantCurrencyCodes[code]}_iso:USD`]
          )
      }
      // Update redis
      hsetAsync(doc._id, newRates).catch(e => logger(e))
    }

    // Save to Couchdb
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
    logger('getExchangeRates', e)
    return {
      data: [
        {
          currency_pair: '',
          date: '',
          exchangeRate: '',
          error: e instanceof Error ? e.message : 'Unknown error'
        }
      ],
      documents: []
    }
  }
}

export const currencyBridgeDB = (
  rateObj: ReturnGetRate,
  constantCurrencyCodes: AssetMap
): void => {
  for (let i = 0; i < rateObj.data.length; i++) {
    const rate = rateObj.data[i]
    if (rate.exchangeRate != null) continue
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
        rate.exchangeRate = div(
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
        rate.exchangeRate = div(
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
        rate.exchangeRate = mul(
          doc[toCurrencyPair(from, bridgeCurrency)],
          doc[toCurrencyPair(bridgeCurrency, to)]
        )
        continue
      }

      if (
        doc[toCurrencyPair(bridgeCurrency, from)] != null &&
        doc[toCurrencyPair(to, bridgeCurrency)] != null
      )
        rate.exchangeRate = div(
          '1',
          mul(
            doc[toCurrencyPair(bridgeCurrency, from)],
            doc[toCurrencyPair(to, bridgeCurrency)]
          ),
          PRECISION
        )
    }
  }
}

export const asRateParam = (param: any): ExchangeRateReq => {
  const { currency_pair, date } = asExchangeRateReq(param)

  if (typeof currency_pair !== 'string' || typeof date !== 'string') {
    throw new Error(
      'Missing or invalid query param(s): currency_pair and date should both be strings'
    )
  }
  const currencyTokens = currencyCodeArray(currency_pair)
  if (currencyTokens.length !== 2) {
    throw new Error(
      'currency_pair query param malformed.  should be [curA]_[curB], ex: "ETH_iso:USD"'
    )
  }
  const parsedDate = normalizeDate(date)
  if (parsedDate == null) {
    throw new Error(
      'date query param malformed.  should be conventional date string, ex:"2019-11-21T15:28:21.123Z"'
    )
  }
  if (Date.parse(parsedDate) > Date.now()) {
    throw new Error('Future date received. Must send past date.')
  }
  return { currency_pair, date: parsedDate }
}
