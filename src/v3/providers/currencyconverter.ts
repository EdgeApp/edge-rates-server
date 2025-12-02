import { asNumber, asObject } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../../config'
import type { NumberMap, RateBuckets, RateProvider } from '../types'
import {
  expandReturnedFiatRates,
  isCurrentFiat,
  reduceRequestedFiatRates
} from '../utils'

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

export const currencyconverter: RateProvider = {
  providerId: 'currencyconverter',
  type: 'api',
  getFiatRates: async ({ targetFiat, requestedRates }, rightNow) => {
    if (apiKey == null) {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const rateBuckets = reduceRequestedFiatRates(requestedRates, rightNow)

    const allResults: RateBuckets = new Map()
    const promises: Array<Promise<void>> = []
    rateBuckets.forEach((ids, date) => {
      if (isCurrentFiat(new Date(date), rightNow)) {
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

    const out = expandReturnedFiatRates(requestedRates, allResults)

    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  }
}
