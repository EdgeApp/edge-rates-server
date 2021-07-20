import AwaitLock from 'await-lock'

import { DbDoc } from '../rates'
import { logger } from './utils'

let LOCK_ID = 0

export const saveToDb = (
  localDB: any,
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

  locks[LOCK_ID].acquireAsync().then(() =>
    localDB
      .bulk({ docs })
      .then(() =>
        logger(
          `Saved document IDs: ${docs
            .map(doc => doc._id)
            .join(', ')} to db: ${db}`
        )
      )
      .catch(e =>
        logger(
          `Error saving document ID: ${docs
            .map(doc => doc._id)
            .join(', ')} to db: ${db}`
        )
      )
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
          throw e
        } else {
          return {
            _id: date
          }
        }
      })
    })
  )
  // TODO: Report db errors to slack and continue
  return documents
}
