import { validate } from 'jsonschema'
import fetch from 'node-fetch'

import { config } from './config'

const { slackWebhookUrl } = config

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

export const snooze = async (ms: number): Promise<void> =>
  new Promise((resolve: Function) => setTimeout(resolve, ms))
