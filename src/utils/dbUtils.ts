import AwaitLock from 'await-lock'
import nano from 'nano'

import { config } from './../config'
import { slackPoster } from './postToSlack'
import { logger } from './utils'

export interface DbDoc
  extends nano.IdentifiedDocument,
    nano.MaybeRevisionedDocument {
  [pair: string]: any
  updated?: boolean
}

let LOCK_ID = 0

export const saveToDb = (
  localDB: nano.DocumentScope<DbDoc>,
  documents: DbDoc[],
  locks = {}
): void => {
  const db: string = localDB?.config?.db ?? ''
  const docs = documents
    .filter(doc => doc.updated === true)
    .map(doc => {
      delete doc.updated
      return doc
    })
  if (docs.length === 0) return
  locks[++LOCK_ID] = new AwaitLock()

  locks[LOCK_ID].acquireAsync().then(async () =>
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
  localDb: nano.DocumentScope<DbDoc>,
  dates: string[]
): Promise<DbDoc[]> => {
  // Grab existing db data for requested dates
  const response = await localDb.fetch({ keys: dates }).catch(e => {
    if (e.error !== 'not_found') {
      slackPoster(config.slackWebhookUrl, e).catch(e)
    }
  })
  if (response == null)
    return dates.map(date => ({
      _id: date
    }))
  return response.rows.map(element => {
    if ('error' in element || element.doc == null)
      return {
        _id: element.key
      }

    return element.doc
  })
}
