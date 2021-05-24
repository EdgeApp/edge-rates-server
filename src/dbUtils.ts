import AwaitLock from 'await-lock'

import { DbDoc, ReturnGetRate } from './rates'

let LOCK_ID = 0

export const saveToDb = (
  localDB: any,
  documents: DbDoc[],
  log: Function,
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
        log(
          `Saved document IDs: ${docs
            .map(doc => doc._id)
            .join(', ')} to db: ${db}`
        )
      )
      .catch(e =>
        log(
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
  rateObj: ReturnGetRate,
  log: Function
): Promise<ReturnGetRate> => {
  // Identify unique requested dates
  const dates: string[] = []
  for (const pair of rateObj.data) {
    if (!dates.includes(pair.data.date)) dates.push(pair.data.date)
  }
  // Grab existing db data for requested dates
  rateObj.documents = await Promise.all(
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
  return rateObj
}
