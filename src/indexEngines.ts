import { setupDatabase } from 'edge-server-tools'

import { coinrankEngine } from './coinrankEngine'
import { config } from './config'
import { ratesEngine } from './ratesEngine'
import { uidEngine } from './uidEngine'
import {
  ratesDbSetup,
  setupCurrencyCodeMapsSync,
  syncedCurrencyCodeMaps
} from './utils/currencyCodeMapsSync'
import { logger } from './utils/utils'

// Initialize DB and currency code maps sync
async function initDb(): Promise<void> {
  // Create a new ratesDbSetup that includes the syncedCurrencyCodeMaps from the new sync module
  const indexEnginesRatesDbSetup = {
    ...ratesDbSetup,
    syncedDocuments: [syncedCurrencyCodeMaps]
  }

  await setupDatabase(config.couchUri, indexEnginesRatesDbSetup)

  // Set up currency code maps sync (only runs in this process)
  setupCurrencyCodeMapsSync()

  ratesEngine().catch(e => {
    logger('ratesEngine failure', e)
  })
  uidEngine().catch(e => {
    logger('uidEngine failure', e)
  })
  coinrankEngine().catch(e => {
    logger('coinrankEngine failure', e)
  })
}

initDb().catch(e => {
  logger('initDbe failure', e)
})
