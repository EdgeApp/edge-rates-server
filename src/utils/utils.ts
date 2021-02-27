import bns from 'biggystring'
import fetch from 'node-fetch'

import { SlackerSettings, State } from '../types/types'

const FIVE_MINUTES = 1000 * 60 * 5

export type Curried<A extends any[], R> = <P extends Partial<A>>(
  ...args: P
) => P extends A
  ? R
  : A extends [...SameLength<P>, ...infer S]
  ? S extends any[]
    ? Curried<S, R>
    : never
  : never

export type SameLength<T extends any[]> = Extract<
  { [K in keyof T]: any },
  any[]
>

export type Curry = <A extends any[], R>(fn: (...args: A) => R) => Curried<A, R>

export const curry: Curry = <A extends any[]>(fn) => (...args: A) =>
  args.length >= fn.length
    ? fn(...(args as any))
    : curry(fn.bind(undefined, ...(args as any)))

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

export const inverseRate = (rate: string): string => bns.div('1', rate, 8, 10)

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

export const slackPoster = async (
  {
    slackWebhookUrl,
    lastText = '',
    lastDate = 1591837000000 // June 10 2020
  }: SlackerSettings,
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
