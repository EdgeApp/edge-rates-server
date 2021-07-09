import nano from 'nano'
import promisify from 'promisify-node'

import { config } from './config'
import { coincapAssets } from './providers/coincap'
import { coinMarketCapAssets } from './providers/coinMarketCap'
import { ONE_DAY } from './utils/constants'
import { getFromDb, saveToDb } from './utils/dbUtils'
import { logger, snooze } from './utils/utils'

const { couchUri } = config

const nanoDb = nano(couchUri)
const dbUniqueIds = nanoDb.db.use('db_uniqueids')
promisify(dbUniqueIds)

export const providers = [coincapAssets, coinMarketCapAssets]

export const uniqueIdEngine = async (): Promise<void> => {
  for (const provider of providers) {
    try {
      const currentAssetMap = await provider()
      // Sanity check that successful return object isn't empty
      if (Object.keys(currentAssetMap).length === 0)
        throw new Error('Empty return object')
      const existingAssetMaps = await getFromDb(dbUniqueIds, [
        provider.name,
        `${provider.name}_EdgeDefaultCurrencyCodes`
      ])
      const oldAssetMap = existingAssetMaps[0]
      const edgePreferredAssetMap = existingAssetMaps[1]
      saveToDb(dbUniqueIds, [
        {
          ...currentAssetMap,
          ...edgePreferredAssetMap,
          _id: provider.name,
          _rev: oldAssetMap._rev ?? undefined,
          updated: true
        }
      ])
    } catch (e) {
      logger(`Failed to update ${provider.name} with error`, e.message)
    }
  }
  logger('SNOOZING ***********************************')
  await snooze(ONE_DAY)
  uniqueIdEngine().catch(e => logger(e))
}
