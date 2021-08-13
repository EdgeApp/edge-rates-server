import nano from 'nano'
import promisify from 'promisify-node'

import { DbDoc } from '../rates'
import { config } from './../config'
import currencyCodeMaps from './currencyCodeMaps.json'
import { slackPoster } from './postToSlack'
import { logger, memoize } from './utils'

const ONE_HOUR = 1000 * 60 * 60

const { couchUri } = config

const nanoDb = nano(couchUri)
const dbRates = nanoDb.db.use('db_rates')
promisify(dbRates)

export const saveToDb = (localDB: any, docs: DbDoc[]): void => {
  const db: string = localDB?.config?.db ?? ''
  if (docs.length === 0) return
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
      console.log(e.message)
      logger(e.message)
      slackPoster(config.slackWebhookUrl, e).catch(e)
    })
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
