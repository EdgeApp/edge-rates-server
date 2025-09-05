import { asArray, asMaybe, asObject, asString } from 'cleaners'
import { syncedDocument } from 'edge-server-tools'

import currencyCodeMaps from './currencyCodeMaps.json'
import { hsetAsync } from './dbUtils'
import { logger } from './utils'

const asCurrencyCodeMapsCleaner = asObject({
  constantCurrencyCodes: asMaybe(asObject(asString)),
  zeroRates: asMaybe(asObject(asString)),
  fallbackConstantRates: asMaybe(asObject(asString)),
  coinMarketCap: asMaybe(asObject(asString)),
  coincap: asMaybe(asObject(asString)),
  coingecko: asMaybe(asObject(asString)),
  allEdgeCurrencies: asMaybe(asArray(asString)),
  fiatCurrencyCodes: asMaybe(asArray(asString))
})

// Pass the defaults json through the cleaner so they're typed
const defaultCurrencyCodeMaps = asCurrencyCodeMapsCleaner(currencyCodeMaps)

const asCurrencyCodeMaps = asMaybe(
  asCurrencyCodeMapsCleaner,
  defaultCurrencyCodeMaps
)

export const syncedCurrencyCodeMaps = syncedDocument(
  'currencyCodeMaps',
  asCurrencyCodeMaps
)

export const ratesDbSetup = {
  name: 'db_rates',
  options: { partitioned: false },
  templates: { currencyCodeMaps },
  syncedDocuments: [] // Empty array since sync is now handled in indexEngines
}

// Set up the sync logic - this will only run in the indexEngines process
export const setupCurrencyCodeMapsSync = (): void => {
  syncedCurrencyCodeMaps.onChange(currencyCodeMaps => {
    const timestamp = new Date().toISOString()
    logger(
      `[${timestamp}] SYNC TRIGGERED: Syncing currency code maps with redis cache...`
    )
    logger(
      `[${timestamp}] SYNC TRIGGER: onChange fired for currencyCodeMaps document (PID: ${process.pid})`
    )

    for (const key of Object.keys(currencyCodeMaps)) {
      const updateKey = async (): Promise<void> => {
        try {
          const data = currencyCodeMaps[key]

          if (Array.isArray(data)) {
            if (data.length === 0) {
              logger(`Skipping Redis update for ${key}: array is empty`)
              return
            }
            await hsetAsync(key, Object.assign({}, data))
          } else if (typeof data === 'object') {
            if (Object.keys(data).length === 0) {
              logger(`Skipping Redis update for ${key}: object is empty`)
              return
            }
            await hsetAsync(key, data)
          } else {
            logger(`Skipping Redis update for ${key}: invalid data type`)
            return
          }

          logger(`Successfully updated Redis key: ${key}`)
        } catch (e) {
          logger('currencyCodeMaps sync failed to update', key, e)
        }
      }

      // Fire and forget - don't await in the callback
      updateKey().catch(e => {
        logger('Unhandled error in updateKey', key, e)
      })
    }
  })
}
