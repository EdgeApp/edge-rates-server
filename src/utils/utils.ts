import { validate } from 'jsonschema'

import { AssetMap, NewRates, RateMap, ReturnRate } from '../rates'
import { config } from './../config'
import { constantCurrencyCodes } from './currencyCodeMaps.json'

const { defaultFiatCode: DEFAULT_FIAT } = config

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

export const snooze = async (ms: number): Promise<void> =>
  new Promise((resolve: Function) => setTimeout(resolve, ms))

export const getNullRateArray = (rates: ReturnRate[]): ReturnRate[] => {
  return rates.filter(rate => rate.exchangeRate === null)
}

export const haveEveryRate = (rates: ReturnRate[]): boolean => {
  return rates.every(rate => rate.exchangeRate !== null)
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

type IsoOp = (code: string) => string
type IsoOpObject = (code: any) => string

export const isFiatCode = (code: string): boolean => code.indexOf('iso:') === 0

export const subIso: IsoOp = code =>
  isFiatCode(code) ? code.split(':')[1] : code

export const addIso: IsoOp = code => (!isFiatCode(code) ? `iso:${code}` : code)

export const toCurrencyPair = (
  codeA: string,
  codeB: string = DEFAULT_FIAT
): string => `${codeA}_${codeB}`

export const toIsoPair = (opA: IsoOp, opB: IsoOp = opA) => (
  codeA: string,
  codeB: string = DEFAULT_FIAT
) => toCurrencyPair(opA(codeA), opB(codeB))

export const fromFiatToFiat = toIsoPair(addIso, addIso)

export const fromCryptoToFiatCurrencyPair = toIsoPair(subIso, addIso)

export const currencyCodeArray = (pair: string): string[] => pair.split('_')

export const fromCode = (pair: string): string => currencyCodeArray(pair)[0]

export const toCode = (pair: string): string => currencyCodeArray(pair)[1]

export const invertPair = (pair: string): string =>
  `${toCode(pair)}_${fromCode(pair)}`

export const createReducedRateMapArray = (
  createCurrencyPair: IsoOpObject,
  createCurrencyQuote: (code: any) => string
) => (data: any[]): RateMap =>
  data.reduce((out, code) => {
    return {
      ...out,
      [createCurrencyPair(code)]: createCurrencyQuote(code)
    }
  }, {})

const useCurrencyCodeAsIs = (code: string): string => code

export const createReducedRateMap = (
  createCurrencyPair: IsoOp,
  createCurrencyQuote: (rates, code: string) => string,
  uniqueId: (id: string, assetMap: AssetMap) => string = useCurrencyCodeAsIs
) => (data, assetMap = {}): RateMap =>
  Object.keys(data).reduce((out, code) => {
    return {
      ...out,
      [createCurrencyPair(uniqueId(code, assetMap))]: createCurrencyQuote(
        data,
        code
      )
    }
  }, {})

export const dateOnly = (date: string): string => date.split('T')[0]

// Unique ID utils

interface Asset {
  id: string
  symbol: string
}

const assetCode = (asset: Asset): string => asset.symbol

const assetId = (asset: Asset): string => asset.id.toString()

export const assetMapReducer = createReducedRateMapArray(assetCode, assetId)
