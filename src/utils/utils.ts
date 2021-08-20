import { validate } from 'jsonschema'

import { AssetMap, NewRates, RateMap, ReturnRate } from '../rates'
import { config } from './../config'

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

export const checkConstantCode = (
  code: string,
  constantCurrencyCodes: AssetMap
): string => constantCurrencyCodes[code] ?? code

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

export const isIsoCode = (code: string): boolean => code.indexOf('iso:') === 0

export const subIso: IsoOp = code =>
  isIsoCode(code) ? code.split(':')[1] : code

export const addIso: IsoOp = code => (!isIsoCode(code) ? `iso:${code}` : code)

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

export const createReducedRateMapArray = <T>(
  createCurrencyPair: IsoOpObject,
  createCurrencyQuote: (code: T) => string
) => (data: T[]): RateMap =>
  data.reduce((out, code) => {
    return {
      ...out,
      [createCurrencyPair(code)]: createCurrencyQuote(code)
    }
  }, {})

const useCurrencyCodeAsIs = (code: string): string => code

export const createReducedRateMap = <T>(
  createCurrencyPair: IsoOp,
  createCurrencyQuote: (rates: T, code: string) => string,
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
  id: string | number
  symbol: string
}

const assetCode = (asset: Asset): string => asset.symbol

const assetId = (asset: Asset): string => asset.id.toString()

export const assetMapReducer = createReducedRateMapArray(assetCode, assetId)

export const assetMapCombiner = (
  edgeMap: AssetMap,
  providerMap: AssetMap
): AssetMap => ({ ...providerMap, ...edgeMap })

const ONE_DAY = 1000 * 60 * 60 * 24

export const memoize = <T>(
  func: (...args) => Promise<T>,
  key: string,
  timeLimit: number = ONE_DAY
): (() => Promise<T>) => {
  const cache: { [key: string]: T } | {} = {}
  const expiration: { [key: string]: number } = {}
  return async (...args) => {
    if (expiration[key] == null || expiration[key] < Date.now()) {
      console.log('Updating ' + key + ' cache...')

      const res = await func(...args)
      if (res != null) {
        cache[key] = res
        expiration[key] = Date.now() + timeLimit
      }
    }
    return cache[key] ?? {}
  }
}

export const createAssetMaps = async (
  edgeMap: AssetMap,
  func: () => Promise<AssetMap>
): Promise<AssetMap> => {
  return assetMapCombiner(edgeMap, await func())
}
