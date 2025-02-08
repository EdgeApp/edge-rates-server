import { setupDatabase } from 'edge-server-tools'

import { coinrankEngine } from './coinrankEngine'
import { config } from './config'
import { ratesEngine } from './ratesEngine'
import { uidEngine } from './uidEngine'
import { ratesDbSetup } from './utils/dbUtils'
import { logger } from './utils/utils'

// Initialize DB
async function initDb(): Promise<void> {
  await setupDatabase(config.couchUri, ratesDbSetup)
  ratesEngine().catch(e => logger('ratesEngine failure', e))
  uidEngine().catch(e => logger('uidEngine failure', e))
  coinrankEngine().catch(e => logger('coinrankEngine failure', e))
}

initDb().catch(e => logger('initDbe failure', e))
