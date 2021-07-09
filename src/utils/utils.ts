import { validate } from 'jsonschema'
import fetch from 'node-fetch'

import { ReturnRate } from '../rates'
import { FIVE_MINUTES } from './constants'
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

let lastText = ''
let lastDate = 1591837000000 // June 10 2020

export const slackPoster = async (
  slackWebhookUrl: string,
  text: string
): Promise<void> => {
  const now = Date.now()
  // check if it's been 5 minutes since last identical message was sent to Slack
  if (
    slackWebhookUrl == null ||
    slackWebhookUrl === '' ||
    (text === lastText && now - lastDate < FIVE_MINUTES) // 5 minutes
  ) {
    return
  }
  try {
    lastText = text
    lastDate = now
    await fetch(slackWebhookUrl, {
      method: 'POST',
      body: JSON.stringify({
        text: `${new Date(now).toISOString()} ${JSON.stringify(text)}`
      })
    })
  } catch (e) {
    console.log('Could not log DB error to Slack', e)
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

export const logger = (...args): void => {
  const isoDate = new Date().toISOString()
  let result = `${isoDate} - `
  for (const arg of args) {
    if (typeof arg === 'string') result += `${arg}, `
    else result += `\n${JSON.stringify(arg)}`
  }
  console.log(result)
}
