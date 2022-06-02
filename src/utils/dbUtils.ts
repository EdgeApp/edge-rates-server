import {
  asArray,
  asBoolean,
  asMaybe,
  asObject,
  asOptional,
  asString
} from 'cleaners'
import { syncedDocument } from 'edge-server-tools'
import nano from 'nano'
import promisify from 'promisify-node'

import { delAsync, hsetAsync } from '../uidEngine'
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
        console.log('Error resolving conflicts', e.message)
      )
    })
    .catch(e => {
      logger(e)
      slackPoster(config.slackWebhookUrl, e).catch(e)
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

export const wrappedGetFromDb = async (dates: string[]): Promise<DbDoc[]> =>
  getFromDb(dbRates, dates)

const asCurrencyCodeMapsCleaner = asObject({
  constantCurrencyCodes: asMaybe(asObject(asString)),
  zeroRates: asMaybe(asObject(asString)),
  fallbackConstantRates: asMaybe(asObject(asString)),
  coinMarketCap: asMaybe(asObject(asString)),
  coincap: asMaybe(asObject(asString)),
  coingecko: asMaybe(asObject(asString)),
  nomics: asMaybe(asObject(asString)),
  allEdgeCurrencies: asMaybe(asArray(asString)),
  fiatCurrencyCodes: asMaybe(asArray(asString))
})

// Pass the defaults json through the cleaner so they're typed
const defaultCurrencyCodeMaps = asCurrencyCodeMapsCleaner(currencyCodeMaps)

const asCurrencyCodeMaps = asMaybe(
  asCurrencyCodeMapsCleaner,
  defaultCurrencyCodeMaps
)

const syncedCurrencyCodeMaps = syncedDocument(
  'currencyCodeMaps',
  asCurrencyCodeMaps
)

syncedCurrencyCodeMaps.onChange(currencyCodeMaps => {
  logger('Syncing currency code maps with redis cache...')
  for (const key of Object.keys(currencyCodeMaps)) {
    delAsync(key)
      .then(() => {
        if (Array.isArray(currencyCodeMaps[key])) {
          hsetAsync(key, Object.assign({}, currencyCodeMaps[key])).catch(e =>
            logger('syncedCurrencyCodeMaps failed to update', key, e)
          )
        } else {
          hsetAsync(key, currencyCodeMaps[key]).catch(e =>
            logger('syncedCurrencyCodeMaps failed to update', key, e)
          )
        }
      })
      .catch(e => logger('syncedCurrencyCodeMaps delete failed', key, e))
  }
})

export const ratesDbSetup = {
  name: 'db_rates',
  options: { partitioned: false },
  templates: { currencyCodeMaps },
  syncedDocuments: [syncedCurrencyCodeMaps]
}

export const getEdgeAssetDoc = memoize(
  async (): Promise<DbDoc> =>
    (await getFromDb(dbRates, ['currencyCodeMaps']))[0],
  'edge',
  ONE_HOUR
)
