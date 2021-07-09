import { validate } from 'jsonschema'

import { NewRates, ReturnRate } from '../rates'
import { constantCurrencyCodes } from './currencyCodeMaps'

/*
 * Returns string value of date "normalized" by floor'ing to nearest
 * hour and translating to UTC time.  Or returns undefined if dateSrc
 * is invalid.
 */
export function normalizeDate(dateSrc: string): string | void {
  const dateNorm = new Date(dateSrc)
  if (dateNorm.toString() === 'Invalid Date') {
    return undefined
  }
  // round down to nearest 10 minutes
  let minutes = dateNorm.getMinutes()
  if (minutes > 0) {
    minutes -= minutes % 10
  }
  dateNorm.setMinutes(minutes)
  dateNorm.setSeconds(0)
  dateNorm.setMilliseconds(0)
  return dateNorm.toISOString()
}

export function validateObject(object: any, schema: any): boolean {
  const result = validate(object, schema)

  if (result.errors.length === 0) {
    return true
  } else {
    for (let i = 0; i < result.errors.length; i++) {
      const errMsg = result.errors[i].message
      console.log(`ERROR: validateObject: ${errMsg}`)
    }
    return false
  }
}

export const snooze = async (ms: number): Promise<void> =>
  new Promise((resolve: Function) => setTimeout(resolve, ms))

export const getNullRateArray = (rates: ReturnRate[]): ReturnRate[] => {
  return rates.filter(rate => rate.exchangeRate === null)
}

export const haveEveryRate = (rates: ReturnRate[]): boolean => {
  return rates.every(rate => rate.exchangeRate !== null)
}

export const invertPair = (pair: string): string => {
  const fromCurrency = pair.split('_')[0]
  const toCurrency = pair.split('_')[1]
  return `${toCurrency}_${fromCurrency}`
}

export const checkConstantCode = (code: string): string =>
  constantCurrencyCodes[code] ?? code

export const isNotANumber = (value: string): boolean => {
  if (
    Number.isNaN(Number(value)) ||
    value.includes(',') ||
    value === '' ||
    /\s/.test(value)
  )
    return true

  return false
}

export const combineRates = (
  currentRates: NewRates,
  incomingRates: NewRates[]
): NewRates => {
  incomingRates.forEach(response => {
    Object.keys(response).forEach(date => {
      if (currentRates[date] == null) currentRates[date] = {}
      Object.assign(currentRates[date], response[date])
    })
  })

  return currentRates
}

export const logger = (...args): void => {
  const isoDate = new Date().toISOString()
  let result = `${isoDate} - `
  for (const arg of args) {
    if (typeof arg === 'string') result += `${arg}, `
    else result += `\n${JSON.stringify(arg)}`
  }
  console.log(result)
}
