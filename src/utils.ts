import { validate } from 'jsonschema'
import fetch from 'node-fetch'

import CONFIG from '../serverConfig.json'

const { slackWebhookUrl, bridgeCurrencies } = CONFIG

let postToSlackText = ''
let postToSlackTime = 1591837000000 // June 10 2020

/*
 * Returns string value of date "normalized" by floor'ing to nearest
 * hour and translating to UTC time.  Or returns undefined if dateSrc
 * is invalid.
 */
function normalizeDate(
  currencyA: string,
  currencyB: string,
  dateSrc: string
): string | void {
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

function validateObject(object: any, schema: any): boolean {
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

async function postToSlack(date: string, text: string): Promise<void> {
  // check if it's been 5 minutes since last identical message was sent to Slack
  if (
    text === postToSlackText &&
    Date.now() - postToSlackTime < 1000 * 60 * 5 // 5 minutes
  ) {
    return
  }
  try {
    await fetch(slackWebhookUrl, {
      method: 'POST',
      body: JSON.stringify({ text: `${date} ${text}` })
    })
    postToSlackText = text
    postToSlackTime = Date.now()
  } catch (e) {
    console.log('Could not log DB error to Slack', e)
  }
}

export const currencyBridge = async (
  getExchangeRate: Function,
  currencyA: string,
  currencyB: string,
  date: string | Function,
  log?: Function
): Promise<string> => {
  for (const currency of bridgeCurrencies) {
    try {
      const currACurr = await getExchangeRate(currencyA, currency, date, log)
      const currCurrB = await getExchangeRate(currency, currencyB, date, log)
      if (currACurr !== '' && currCurrB !== '') {
        return (parseFloat(currACurr) * parseFloat(currCurrB)).toString()
      }
    } catch (e) {
      console.log(e)
    }
  }
  return ''
}

const coinMarketCapFiatMap = {
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

const fiatCurrencyCodes: { [code: string]: boolean } = {
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

export {
  normalizeDate,
  validateObject,
  postToSlack,
  coinMarketCapFiatMap,
  fiatCurrencyCodes
}
