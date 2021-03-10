import bns from 'biggystring'

import { State } from '../types/types'

export type SameLength<T extends any[]> = Extract<
  { [K in keyof T]: any },
  any[]
>

export type FuncArityOne = (args: any) => any
export type FuncArityN = (...args: any) => any

export type ArrayHead<T extends any[]> = T extends [...infer Head, any]
  ? Head
  : never

export type PickLastInTuple<T extends any[]> = T extends [
  ...ArrayHead<T>,
  infer Last
]
  ? Last
  : never

export type Curried<A extends any[], R> = <P extends Partial<A>>(
  ...args: P
) => P extends A
  ? R
  : A extends [...SameLength<P>, ...infer S]
  ? S extends any[]
    ? Curried<S, R>
    : never
  : never

export type Curry = <A extends any[], R>(fn: (...args: A) => R) => Curried<A, R>

export type Pipe = <T extends FuncArityN, R extends FuncArityOne[]>(
  ...funcs: [T, ...R]
) => (...args: Parameters<T>) => ReturnType<PickLastInTuple<R>>

export type Compose = <T extends FuncArityOne[], R extends FuncArityN>(
  ...funcs: [...T, R]
) => (...args: Parameters<R>) => ReturnType<PickLastInTuple<T>>

export const curry: Curry = <A extends any[]>(fn) => (...args: A) =>
  args.length >= fn.length
    ? fn(...(args as any))
    : curry(fn.bind(undefined, ...(args as any)))

export const pipe: Pipe = (...funcs) =>
  funcs.reduce((curried, func) => (...args) =>
    func((curried as FuncArityN)(...args))
  )

export const compose: Compose = (...funcs) =>
  funcs.reduce((curried, func) => args => curried(func(args)))

export const logger = (...args): void => {
  const isoDate = new Date().toISOString()
  let result = `${isoDate} - `
  for (const arg of args) {
    if (typeof arg === 'string') result += `${arg}, `
    else result += `\n${JSON.stringify(arg)}`
  }
  console.log(result)
}
/*
 * Returns string value of date "normalized" by floor'ing to nearest
 * hour and translating to UTC time.  Or returns undefined if dateSrc
 * is invalid.
 */
export function normalizeDate(dateSrc: string): string | undefined {
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

export const inverseRate = (rate: string): string =>
  rate === '0' ? '0' : bns.div('1', rate, 8, 10)

export const snooze = async (ms: number): Promise<void> =>
  await new Promise((resolve: Function) => setTimeout(resolve, ms))

// Merge/Add the documents from origin to destination
export const mergeDocuments = <T>(
  destination: State<T>,
  origin: State<T>
): State<T> =>
  Object.keys(destination).length === 0
    ? { ...origin }
    : Object.keys(origin)
        .map(id => ({
          [id]:
            destination[id] == null
              ? origin[id]
              : { ...destination[id], ...origin[id] }
        }))
        .reduce((result, document) => ({ ...result, ...document }), destination)
