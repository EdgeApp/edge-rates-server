import { asBoolean, asMaybe, asObject, asOptional, asString } from 'cleaners'
import nano from 'nano'
import promisify from 'promisify-node'
import { createClient } from 'redis'

import { config } from './../config'
import { createThrottledMessage } from './createThrottledMessage'
import { slackPoster } from './postToSlack'
import { logger, memoize } from './utils'

const client = createClient()
client.on('connect', () => {
  logger('onConnect to Redis')
})

client.on('error', (err: unknown) => {
  logger('Redis connection error:', String(err))
})
client.connect().catch(e => {
  logger('redis connect error: ', e)
})

export const hsetAsync = client.hSet.bind(client)
export const hgetallAsync = client.hGetAll.bind(client)
export const hmgetAsync = client.hmGet.bind(client)
export const existsAsync = client.exists.bind(client)
export const delAsync = client.del.bind(client)
export const renameAsync = client.rename.bind(client)
// Set type to `any` to avoid the TS4023 error
export const setAsync: any = client.set.bind(client)
export const getAsync: any = client.get.bind(client)

const ONE_HOUR = 1000 * 60 * 60

export const slackMessage = createThrottledMessage(client, slackPoster)

export interface DbDoc
  extends nano.IdentifiedDocument,
    nano.MaybeRevisionedDocument {
  [pair: string]: any
  updated?: boolean
}

export const asDbDoc = (raw): DbDoc => {
  return {
    ...asObject({ updated: asOptional(asBoolean), _id: asString })(raw),
    ...asObject(asMaybe(asString))(raw)
  }
}

const { couchUri } = config

const nanoDb = nano(couchUri)
const dbRates: nano.DocumentScope<DbDoc> = nanoDb.db.use('db_rates')
promisify(dbRates)

const findDoc = (id: string, arr: DbDoc[]): DbDoc | undefined =>
  arr.find(doc => doc._id === id)

const resolveConflicts = async (
  response: nano.DocumentBulkResponse[],
  allDocs: DbDoc[]
): Promise<void> => {
  const conflictIds = response
    .filter(doc => doc.error === 'conflict')
    .map(doc => doc.id)
  if (conflictIds.length === 0) return
  const latestDocs = await getFromDb(dbRates, conflictIds)
  const out: DbDoc[] = []
  conflictIds.forEach(id => {
    const latest = findDoc(id, latestDocs)
    if (latest != null) {
      const conflict = findDoc(id, allDocs)
      out.push({
        ...conflict,
        ...latest
      })
    }
  })
  if (out.length > 0) saveToDb(dbRates, out)
}

const dbResponseLogger = (response: nano.DocumentBulkResponse[]): void => {
  const successArray = response
    .filter(doc => doc.error == null)
    .map(doc => doc.id)
  if (successArray.length > 0)
    logger(`Saved document IDs: ${successArray.join(', ')} to db_rates`)

  const failureArray = response
    // Conflicts are expected and OK so no need to print. They'll be combined and retried until successfully saved.
    // Future TODO: will be to save to the db on a loop from redis store.
    .filter(doc => doc.error != null && doc.error !== 'conflict')
    .map(doc => `${doc.id}: ${doc.error}`)
  if (failureArray.length > 0)
    logger(`Error saving document IDs: ${failureArray.join(', ')} to db_rates`)
}

export const saveToDb = (
  localDB: nano.DocumentScope<DbDoc>,
  docs: DbDoc[]
): void => {
  if (docs.length === 0) return
  localDB
    .bulk({ docs })
    .then(response => {
      dbResponseLogger(response)
      resolveConflicts(response, docs).catch(e =>
        logger('Error resolving conflicts', e.message)
      )
    })
    .catch(e => {
      logger(e)
      slackMessage(e).catch(e)
    })
}

export const wrappedSaveToDb = (docs: DbDoc[]): void => saveToDb(dbRates, docs)

export const getFromDb = async (
  localDb: nano.DocumentScope<DbDoc>,
  dates: string[]
): Promise<DbDoc[]> => {
  // Grab existing db data for requested dates
  const response = await localDb.fetch({ keys: dates }).catch(e => {
    if (e.error !== 'not_found') {
      slackMessage(e).catch(e)
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

export const wrappedGetFromDb = async (dates: string[]): Promise<DbDoc[]> =>
  getFromDb(dbRates, dates)

export const getEdgeAssetDoc = memoize(
  async (): Promise<DbDoc> =>
    (await getFromDb(dbRates, ['currencyCodeMaps']))[0],
  'edge',
  ONE_HOUR
)
