import { setupDatabase } from 'edge-server-tools'

import { config } from './config'
import { ratesEngine } from './ratesEngine'
import { ratesDbSetup } from './utils/dbUtils'

// Initialize DB
async function initDb(): Promise<void> {
  await setupDatabase(config.couchUri, ratesDbSetup)
  ratesEngine().catch(e => console.log(e))
}

initDb().catch(e => console.log(e))
