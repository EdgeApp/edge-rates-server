import { bns } from 'biggystring'
import fetch from 'node-fetch'

import { config } from './config'

const FIVE_MINUTES = 1000 * 60 * 5

export const inverseRate = (rate: string): string => bns.div('1', rate, 8, 10)

export const curry = (fn: any) => (...args: any[]): any =>
  args.length >= fn.length
    ? fn(...(args as any))
    : curry(fn.bind(undefined, ...args))

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

export const SlackPoster = (
  lastText = '',
  lastDate = Date.now() - FIVE_MINUTES,
  { slackWebhookUrl } = config
) => async (date: string, text: string): Promise<void> => {
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('47. date', date)
  console.log('48. text', text)
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  // check if it's been 5 minutes since last identical message was sent to Slack
  if (
    slackWebhookUrl == null ||
    slackWebhookUrl === '' ||
    (text === lastText && Date.now() - lastDate < FIVE_MINUTES) // 5 minutes
  ) {
    return
  }
  try {
    lastText = text
    lastDate = Date.now()
    await fetch(slackWebhookUrl, {
      method: 'POST',
      body: JSON.stringify({ text: `${date} ${text}` })
    })
  } catch (e) {
    console.log('Could not log DB error to Slack', e)
  }
}

export const snooze = async (ms: number): Promise<void> =>
  new Promise((resolve: Function) => setTimeout(resolve, ms))
