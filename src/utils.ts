import { bns } from 'biggystring'
import { asObject, asOptional, asString } from 'cleaners'
import { validate } from 'jsonschema'
import nano from 'nano'
import fetch from 'node-fetch'

import CONFIG from '../serverConfig.json'
import { coincapHistorical } from './coincap'
import { coinMarketCapHistorical } from './coinMarketCap'
import { coinMarketCapCurrent } from './coinMarketCapBasic'
import { currencyConverter } from './currencyConverter'

const { slackWebhookUrl, bridgeCurrencies } = CONFIG

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

let postToSlackText = ''
let postToSlackTime = 1591837000000 // June 10 2020

export async function postToSlack(date: string, text: string): Promise<void> {
  // check if it's been 5 minutes since last identical message was sent to Slack
  if (
    text === postToSlackText &&
    Date.now() - postToSlackTime < 1000 * 60 * 5 // 5 minutes
  ) {
    return
  }
  try {
    postToSlackText = text
    postToSlackTime = Date.now()
    await fetch(slackWebhookUrl, {
      method: 'POST',
      body: JSON.stringify({ text: `${date} ${text}` })
    })
  } catch (e) {
    console.log('Could not log DB error to Slack', e)
  }
}

export interface ReturnRate {
  currency_pair?: string
  date?: string
  exchangeRate?: string
  error?: Error
}

const zeroRateCurrencyCodes = {
  UFO: true,
  FORK: true
}

const fallbackConstantRatePairs = {
  SAI_USD: 1,
  DAI_USD: 1
}

// use this mock for unit testing for getFromDb
// const localDb = {
//   get: date => fixtures[date]
// }

type ProviderFetch = (
  localDb: any,
  currencyA: string,
  currencyB: string,
  date: string,
  log: Function
) => Promise<string>

// move to a separate file, use type for all other providers
const getFromDb: ProviderFetch = async (
  localDb,
  currencyA,
  currencyB,
  date,
  log
) => {
  let rate = ''
  try {
    const exchangeRate: nano.DocumentGetResponse & {
      [pair: string]: any
    } = await localDb.get(date)
    if (exchangeRate[`${currencyA}_${currencyB}`] != null) {
      rate = exchangeRate[`${currencyA}_${currencyB}`]
    } else if (exchangeRate[`${currencyB}_${currencyA}`] != null) {
      rate = bns.div('1', exchangeRate[`${currencyB}_${currencyA}`], 8, 10)
    }
  } catch (e) {
    if (e.error !== 'not_found') {
      log(`DB read error ${JSON.stringify(e)}`)
      throw e
    }
  }
  return rate
}

// use this mock for unit testing for currencyBridge
// const getExchangeRate = async (currencyA, currencyB, date, log) =>
// fixtures[`${currencyA}_${currencyB}`][date]

export const currencyBridge = async (
  getExchangeRate: Function,
  currencyA: string,
  currencyB: string,
  date: string,
  log: Function,
  currencyRates: nano.DocumentGetResponse
): Promise<void> => {
  for (const currency of bridgeCurrencies) {
    const pair1 = `${currencyA}_${currency}`
    const pair2 = `${currency}_${currencyB}`
    if (currencyA === currency || currencyB === currency) continue
    try {
      const currACurr =
        currencyRates[pair1] ??
        (await getExchangeRate(currencyA, currency, date, log))
      if (currACurr !== '') Object.assign(currencyRates, { [pair1]: currACurr })
      const currCurrB =
        currencyRates[pair2] ??
        (await getExchangeRate(currency, currencyB, date, log))
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

// should be its own file
const getRate = async (
  localDb: any,
  currencyA: string,
  currencyB: string,
  currencyPair: string,
  date: string,
  log: Function
): Promise<string> => {
  if (
    zeroRateCurrencyCodes[currencyA] === true ||
    zeroRateCurrencyCodes[currencyB] === true
  )
    return '0'
  try {
    const dbRate = await getFromDb(localDb, currencyA, currencyB, date, log)
    if (dbRate != null && dbRate !== '') return dbRate

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
      () => '',
      currencyA,
      currencyB,
      date,
      log,
      existingDocument
    )
    const dbBridge = existingDocument[currencyPair]
    if (dbBridge != null && dbBridge !== '') return dbBridge

    const exchanges = [
      currencyConverter,
      coinMarketCapCurrent,
      coincapHistorical,
      coinMarketCapHistorical
    ]
    let bridge = ''
    for (const exchange of exchanges) {
      bridge = await exchange(currencyA, currencyB, date, log)
      if (bridge != null && bridge !== '') {
        existingDocument[currencyPair] = bridge
        break
      }

      await currencyBridge(
        exchange,
        currencyA,
        currencyB,
        date,
        log,
        existingDocument
      )

      bridge = existingDocument[currencyPair]
      if (bridge != null && bridge !== '') {
        break
      }
    }

    if (bridge != null && bridge !== '') {
      await localDb.insert(existingDocument).catch(e => {
        if (e.error !== 'conflict') {
          // write more informative error messages
          throw rateError(
            'Future date received. Must send past date.',
            400,
            'conflict'
          )
        }
        log(`DB write error ${JSON.stringify(e)}`)
      })
      return bridge
    }

    // Use fallback hardcoded rates if lookups failed
    if (fallbackConstantRatePairs[`${currencyA}_${currencyB}`] != null) {
      return fallbackConstantRatePairs[`${currencyA}_${currencyB}`]
    }

    if (fallbackConstantRatePairs[`${currencyB}_${currencyA}`] != null) {
      return fallbackConstantRatePairs[`${currencyB}_${currencyA}`]
    }

    // write more informative error messages
    // for requests older than a week, save 0 for a failed request, but only if the date is older than a week. (time period of week is a number from config file, can be changed)
    throw rateError(
      'All lookups failed to find exchange rate.',
      400,
      'not_found'
    )
  } catch (e) {
    if (e.errorCode === 400) throw e
    throw rateError(e.message, 500, 'db_error')
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

// should be same file as getRate
export const getExchangeRate = async (
  query: ReturnType<typeof asExchangeRateReq>,
  localDb: any
): Promise<ReturnRate> => {
  try {
    const { currencyA, currencyB, currencyPair, date } = asRateParam(query)
    const log = (...args): void => {
      const d = new Date().toISOString()
      const p = currencyPair
      console.log(`${d} ${p} ${JSON.stringify(args)}`)
    }
    const exchangeRate = await getRate(
      localDb,
      currencyA,
      currencyB,
      currencyPair,
      date,
      log
    )
    return {
      currency_pair: currencyPair,
      date,
      exchangeRate
    }
  } catch (e) {
    // write more informative error messages, write error + message + code

    if (e.errorType === 'db_error') {
      postToSlack(
        new Date().toISOString(),
        `exchangeRate query failed ${e.message}`
      ).catch(e)
    }
    return {
      currency_pair: query.currency_pair,
      error: e
    }
  }
}

// move to separate js file
export const coinMarketCapFiatMap = {
  USD: '2781',
  AUD: '2782',
  BRL: '2783',
  CAD: '2784',
  CHF: '2785',
  CLP: '2786',
  CNY: '2787',
  CZK: '2788',
  DKK: '2789',
  EUR: '2790',
  GBP: '2791',
  HKD: '2792',
  HUF: '2793',
  IDR: '2794',
  ILS: '2795',
  INR: '2796',
  JPY: '2797',
  KRW: '2798',
  MXN: '2799',
  MYR: '2800',
  NOK: '2801',
  NZD: '2802',
  PHP: '2803',
  PKR: '2804',
  PLN: '2805',
  RUB: '2806',
  SEK: '2807',
  SGD: '2808',
  THB: '2809',
  TRY: '2810',
  TWD: '2811',
  ZAR: '2812',
  AED: '2813',
  BGN: '2814',
  HRK: '2815',
  MUR: '2816',
  RON: '2817',
  ISK: '2818',
  NGN: '2819',
  COP: '2820',
  ARS: '2821',
  PEN: '2822',
  VND: '2823',
  UAH: '2824',
  BOB: '2832',
  ALL: '3526',
  AMD: '3527',
  AZN: '3528',
  BAM: '3529',
  BDT: '3530',
  BHD: '3531',
  BMD: '3532',
  BYN: '3533',
  CRC: '3534',
  CUP: '3535',
  DOP: '3536',
  DZD: '3537',
  EGP: '3538',
  GEL: '3539',
  GHS: '3540',
  GTQ: '3541',
  HNL: '3542',
  IQD: '3543',
  IRR: '3544',
  JMD: '3545',
  JOD: '3546',
  KES: '3547',
  KGS: '3548',
  KHR: '3549',
  KWD: '3550',
  KZT: '3551',
  LBP: '3552',
  LKR: '3553',
  MAD: '3554',
  MDL: '3555',
  MKD: '3556',
  MMK: '3557',
  MNT: '3558',
  NAD: '3559',
  NIO: '3560',
  NPR: '3561',
  OMR: '3562',
  PAB: '3563',
  QAR: '3564',
  RSD: '3565',
  SAR: '3566',
  SSP: '3567',
  TND: '3568',
  TTD: '3569',
  UGX: '3570',
  UYU: '3571',
  UZS: '3572',
  VES: '3573'
}

// move to separate js file
export const fiatCurrencyCodes: { [code: string]: boolean } = {
  ALL: true,
  XCD: true,
  EUR: true,
  BBD: true,
  BTN: true,
  BND: true,
  XAF: true,
  CUP: true,
  USD: true,
  FKP: true,
  GIP: true,
  HUF: true,
  IRR: true,
  JMD: true,
  AUD: true,
  LAK: true,
  LYD: true,
  MKD: true,
  XOF: true,
  NZD: true,
  OMR: true,
  PGK: true,
  RWF: true,
  WST: true,
  RSD: true,
  SEK: true,
  TZS: true,
  AMD: true,
  BSD: true,
  BAM: true,
  CVE: true,
  CNY: true,
  CRC: true,
  CZK: true,
  ERN: true,
  GEL: true,
  HTG: true,
  INR: true,
  JOD: true,
  KRW: true,
  LBP: true,
  MWK: true,
  MRO: true,
  MZN: true,
  ANG: true,
  PEN: true,
  QAR: true,
  STD: true,
  SLL: true,
  SOS: true,
  SDG: true,
  SYP: true,
  AOA: true,
  AWG: true,
  BHD: true,
  BZD: true,
  BWP: true,
  BIF: true,
  KYD: true,
  COP: true,
  DKK: true,
  GTQ: true,
  HNL: true,
  IDR: true,
  ILS: true,
  KZT: true,
  KWD: true,
  LSL: true,
  MYR: true,
  MUR: true,
  MNT: true,
  MMK: true,
  NGN: true,
  PAB: true,
  PHP: true,
  RON: true,
  SAR: true,
  SGD: true,
  ZAR: true,
  SRD: true,
  TWD: true,
  TOP: true,
  VEF: true,
  DZD: true,
  ARS: true,
  AZN: true,
  BYR: true,
  BOB: true,
  BGN: true,
  CAD: true,
  CLP: true,
  CDF: true,
  DOP: true,
  FJD: true,
  GMD: true,
  GYD: true,
  ISK: true,
  IQD: true,
  JPY: true,
  KPW: true,
  LVL: true,
  CHF: true,
  MGA: true,
  MDL: true,
  MAD: true,
  NPR: true,
  NIO: true,
  PKR: true,
  PYG: true,
  SHP: true,
  SCR: true,
  SBD: true,
  LKR: true,
  THB: true,
  TRY: true,
  AED: true,
  VUV: true,
  YER: true,
  AFN: true,
  BDT: true,
  BRL: true,
  KHR: true,
  KMF: true,
  HRK: true,
  DJF: true,
  EGP: true,
  ETB: true,
  XPF: true,
  GHS: true,
  GNF: true,
  HKD: true,
  XDR: true,
  KES: true,
  KGS: true,
  LRD: true,
  MOP: true,
  MVR: true,
  MXN: true,
  NAD: true,
  NOK: true,
  PLN: true,
  RUB: true,
  SZL: true,
  TJS: true,
  TTD: true,
  UGX: true,
  UYU: true,
  VND: true,
  TND: true,
  UAH: true,
  UZS: true,
  TMT: true,
  GBP: true,
  ZMW: true,
  BYN: true,
  BMD: true,
  GGP: true,
  CLF: true,
  CUC: true,
  IMP: true,
  JEP: true,
  SVC: true,
  ZMK: true,
  XAG: true,
  ZWL: true
}
