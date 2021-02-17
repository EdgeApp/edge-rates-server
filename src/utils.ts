import { bns } from 'biggystring'
import fetch from 'node-fetch'

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
  slackWebhookUrl,
  lastText = '',
  lastDate = 1591837000000 // June 10 2020
) => async (text: string): Promise<void> => {
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('48. text', text)
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
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
