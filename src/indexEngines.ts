import { setupDatabase } from 'edge-server-tools'

import { config } from './config'
import { ratesEngine } from './ratesEngine'
import { uidEngine } from './uidEngine'
import { ratesDbSetup } from './utils/dbUtils'
import { snooze } from './utils/utils'

// Initialize DB
async function initDb(): Promise<void> {
  await setupDatabase(config.couchUri, ratesDbSetup)
  await snooze(1000) // give redis cache a moment to get updated from couch
  ratesEngine().catch(e => console.log(e))
  uidEngine().catch(e => console.log(e))
}

initDb().catch(e => console.log(e))
