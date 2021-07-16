import nano from 'nano'
import promisify from 'promisify-node'

import { config } from './config'
import { coincapAssets } from './providers/coincap'
import { coinMarketCapAssets } from './providers/coinMarketCap'
import { AssetMap } from './rates'
import { getFromDb, saveToDb } from './utils/dbUtils'
import { logger, snooze } from './utils/utils'

const assetProviders = [coinMarketCapAssets, coincapAssets]

const { couchUri } = config

const ONE_DAY = 1000 * 60 * 60 * 24

const nanoDb = nano(couchUri)
const dbRates = nanoDb.db.use('db_rates')
promisify(dbRates)

const queryUniqueIds = async (providers: Function[]): Promise<void> => {
  const dbResponse = await getFromDb(dbRates, ['currencyCodeMaps'])
  const assetDoc = dbResponse[0]

  // Query codes
  for (const provider of providers) {
    try {
      const providerName = provider.name.substring(
        0,
        provider.name.indexOf('Assets')
      )
      if (assetDoc[providerName] == null) assetDoc[providerName] = {}
      const currentAssetMap: AssetMap = assetDoc[providerName]
      const newAssetMap: AssetMap = await provider()

      // Sanity check that successful return object isn't empty
      if (Object.keys(newAssetMap).length === 0)
        throw new Error('Empty return object')

      assetDoc[providerName] = {
        ...newAssetMap,
        ...currentAssetMap
      }
      logger(`Successfully updated ${provider.name}`)
    } catch (e) {
      logger(`Failed to update ${provider.name} with error ${e.message}`)
    }
  }

  // Save to DB
  try {
    await saveToDb(dbRates, [assetDoc])
    logger(`Successfully updated asset map document ${assetDoc._id}`)
  } catch (e) {
    logger(
      `Failed to update asset map document ${assetDoc._id} with error ${e.message}`
    )
  }
}

export const uniqueIdEngine = async (): Promise<void> => {
  await queryUniqueIds(assetProviders)
  logger('SNOOZING ***********************************')
  await snooze(ONE_DAY)
  uniqueIdEngine().catch(e => logger(e))
}
