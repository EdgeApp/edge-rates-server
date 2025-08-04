import { asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../../config'
import { NumberMap, RateBuckets, RateProvider } from '../types'
import { expandReturnedFiatRates, reduceRequestedFiatRates } from '../utils'

const {
  providers: {
    currencyConverter: { uri, apiKey }
  }
} = config

const asCurrencyConvertorQuotes = asObject(asNumber)

const dateOnly = (date: string): string => date.split('T')[0]

const fetchCurrencyConverter = async (
  targetFiat: string,
  codes: string[],
  date?: string
): Promise<NumberMap> => {
  if (codes.length === 0) return {}

  let dateString = ''
  if (date != null) {
    dateString = `&date=${dateOnly(date)}`
  }

  const pairs = codes.map(code => `${code}_${targetFiat}`).join(',')

  const response = await fetch(
    `${uri}/api/v8/convert?q=${pairs}${dateString}&apiKey=${apiKey}&compact=ultra`
  )

  if (!response.ok) {
    throw new Error(
      `currencyConverter returned with status: ${response.status}`
    )
  }

  const data = await response.json()

  if (date == null) {
    const quotes = asCurrencyConvertorQuotes(data)
    const out: NumberMap = {}
    for (const [key, value] of Object.entries(quotes)) {
      out[key.replace(`_${targetFiat}`, '')] = value
    }
    return out
  } else {
    const quotes = asObject(asCurrencyConvertorQuotes)(data)
    const out: NumberMap = {}
    for (const [key, value] of Object.entries(quotes)) {
      out[key.replace(`_${targetFiat}`, '')] = value[dateOnly(date)]
    }
    return out
  }
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

const isCurrent = (isoDate: Date, nowDate: Date): boolean => {
  const requestedDate = isoDate.getTime()
  const rightNow = nowDate.getTime()
  if (
    requestedDate > rightNow ||
    requestedDate + TWENTY_FOUR_HOURS < rightNow
  ) {
    return false
  }
  return true
}

export const currencyconverter: RateProvider = {
  providerId: 'currencyconverter',
  type: 'api',
  getFiatRates: async ({ targetFiat, requestedRates }) => {
    if (apiKey == null) {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rateBuckets = reduceRequestedFiatRates(
      requestedRates,
      TWENTY_FOUR_HOURS
    )

    const currentDate = new Date()
    const allResults: RateBuckets = new Map()
    const promises: Array<Promise<void>> = []
    rateBuckets.forEach((ids, date) => {
      if (isCurrent(new Date(date), currentDate)) {
        promises.push(
          fetchCurrencyConverter(targetFiat, Array.from(ids)).then(results => {
            allResults.set(date, results)
          })
        )
      } else {
        promises.push(
          fetchCurrencyConverter(targetFiat, Array.from(ids), date).then(
            results => {
              allResults.set(date, results)
            }
          )
        )
      }
    })
    await Promise.all(promises)

    const out = expandReturnedFiatRates(
      requestedRates,
      TWENTY_FOUR_HOURS,
      allResults
    )

    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  }
}
