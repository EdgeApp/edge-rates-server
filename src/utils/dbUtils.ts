import AwaitLock from 'await-lock'

import { DbLoadFunction, DbSaveFunction } from '../types/types'
import { logger } from './utils'

export const saveCouchdbDocuments: DbSaveFunction = (
  { localDB, log = logger, locks = {} },
  documents
) => {
  const db: string = localDB?.config?.db ?? ''
  for (const document of Object.values(documents)) {
    const { _id } = document
    locks[_id] = locks[_id] ?? new AwaitLock()

    locks[_id]
      .acquireAsync()
      .then(() => localDB.insert(document))
      .then(() => log(`Saved document ID: ${_id} to db: ${db}`))
      .catch(e => log(`Error saving document ID: ${_id} to db: ${db}`))
      .finally(() => {
        locks[_id].release()
        if (locks[_id]._waitingResolvers.length === 0) {
          const { [_id]: lock, ...rest } = locks
          locks = rest
        }
      })
  }
}

export const loadCouchdbDocuments: DbLoadFunction = async (
  { localDB, log = logger },
  documents
) => {
  const db: string = localDB?.config?.db ?? ''
  // Create a "get" promise array using all the documents ids
  const getPromises = Object.keys(documents).map(id =>
    documents[id] != null || Object.keys(documents[id]).length > 0
      ? { ...documents[id] }
      : localDB
          .get(id)
          .then(document => document)
          .catch(e => {
            if (e.error !== 'not_found') throw e
            log(`Document ID: ${id} does not exist in db: ${db}`)
            return { _id: id }
          })
  )
  // Run all the promises in parallel and then reduce the results into a document map
  return Promise.all(getPromises).then(documents =>
    documents.reduce(
      (result, doc) => Object.assign(result, { [doc._id]: doc }),
      {}
    )
  )
}
