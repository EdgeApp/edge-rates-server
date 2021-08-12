import { asBoolean, asMaybe, asObject, asOptional, asString } from 'cleaners'
import nano from 'nano'
import promisify from 'promisify-node'

import { config } from './../config'
import currencyCodeMaps from './currencyCodeMaps.json'
import { slackPoster } from './postToSlack'
import { logger, memoize } from './utils'

const ONE_HOUR = 1000 * 60 * 60

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

interface NanoBulkResponse {
  id: string
  rev: string
  error?: string
  reason?: string
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
    })
    .catch(e => {
      logger(e)
      slackPoster(config.slackWebhookUrl, e).catch(e)
    })
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

export const ratesDbSetup = {
  name: 'db_rates',
  options: { partitioned: false },
  documents: { currencyCodeMaps }
}

export const getEdgeAssetDoc = memoize(
  async (): Promise<DbDoc> =>
    (await getFromDb(dbRates, ['currencyCodeMaps']))[0],
  'edge',
  ONE_HOUR
)
