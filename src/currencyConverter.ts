import { bns } from 'biggystring'
import { asMap, asNumber } from 'cleaners'
import fetch from 'node-fetch'

import CONFIG from '../serverConfig.json'
import { ExchangeResponse } from './index'

const apiKey = CONFIG.currencyConverterApiKey
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

const asCurrencyConverterResponse = asMap(asMap(asNumber))

// take two currencies instead of pair
const currencyConverterFetch = async (
  currency: string,
  date: string
): Promise<string> => {
  if (apiKey !== '') {
    const pair = `${currency}_USD`
    const options = {
      method: 'GET'
    }
    const url = `https://free.currconv.com/api/v7/convert?q=${pair}&compact=ultra&date=${date}&apiKey=${apiKey}`
    try {
      const result = await fetch(url, options)
      const jsonObj = await result.json()
      asCurrencyConverterResponse(jsonObj)
      return jsonObj[pair][date].toString()
    } catch (e) {
      console.error(
        e,
        `CurrencyConverter response is invalid ${currency} date:${date}`
      )
    }
  } else {
    console.error('Missing config CurrencyConverter')
  }
  return ''
}

const currencyConverter = async (
  currencyA: string,
  currencyB: string,
  date: string
): Promise<ExchangeResponse> => {
  if (
    fiatCurrencyCodes[currencyA] == null ||
    fiatCurrencyCodes[currencyB] == null
  ) {
    return
  }
  const normalToDate = date.substring(0, 10)
  const aToUsdRate = await currencyConverterFetch(currencyA, normalToDate)
  if (aToUsdRate === '') {
    return
  }
  if (currencyB === 'USD') {
    return {
      rate: aToUsdRate,
      needsWrite: true
    }
  }
  const bToUsdRate = await currencyConverterFetch(currencyB, normalToDate)
  if (bToUsdRate === '') {
    return
  }
  return {
    rate: bns.div(aToUsdRate, bToUsdRate, 8),
    needsWrite: true
  }
}

export { currencyConverter }
