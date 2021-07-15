import AwaitLock from 'await-lock'

import { DbDoc } from '../rates'
import { config } from './../config'
import { slackPoster } from './postToSlack'
import { logger } from './utils'

let LOCK_ID = 0

export const saveToDb = (localDB: any, docs: DbDoc[], locks = {}): void => {
  const db: string = localDB?.config?.db ?? ''
  if (docs.length === 0) return
  locks[++LOCK_ID] = new AwaitLock()
  locks[LOCK_ID].acquireAsync().then(() =>
    localDB
      .bulk({ docs })
      .then(response => {
        const successArray = response
          .filter(doc => doc.error == null)
          .map(doc => doc.id)
        if (successArray.length > 0)
          logger(`Saved document IDs: ${successArray.join(', ')} to db: ${db}`)

        const failureArray = response
          .filter(doc => doc.error != null)
          .map(doc => `${doc.id}: ${doc.error}`)
        if (failureArray.length > 0)
          logger(
            `Error saving document IDs: ${failureArray.join(', ')} to db: ${db}`
          )
      })
      .catch(e => {
        slackPoster(config.slackWebhookUrl, e).catch(e)
      })
      .finally(() => {
        locks[LOCK_ID].release()
        if (locks[LOCK_ID]._waitingResolvers.length === 0) {
          delete locks[LOCK_ID]
        }
      })
  )
}

export const getFromDb = async (
  localDb: any,
  dates: string[]
): Promise<DbDoc[]> => {
  // Grab existing db data for requested dates
  const documents = await Promise.all(
    dates.map(date => {
      return localDb.get(date).catch(e => {
        if (e.error !== 'not_found') {
          slackPoster(config.slackWebhookUrl, e).catch(e)
        } else {
          return {
            _id: date
          }
        }
      })
    })
  )
  return documents
}
