import fetch from 'node-fetch'

import CONFIG from '../serverConfig.json'

const { slackWebhookUrl } = CONFIG

export const log = (...args): void => {
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

export const snooze = async (ms: number): Promise<void> =>
  new Promise((resolve: Function) => setTimeout(resolve, ms))
