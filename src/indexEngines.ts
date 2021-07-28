import { setupDatabase } from 'edge-server-tools'

import { config } from './config'
import { ratesEngine } from './ratesEngine'
import { uniqueIdEngine } from './uniqueIdEngine'
import { ratesDbSetup } from './utils/dbUtils'

async function startEngines(): Promise<void> {
  await setupDatabase(config.couchUri, ratesDbSetup)
  ratesEngine().catch(e => console.log(e))
  uniqueIdEngine().catch(e => console.log(e))
}

startEngines().catch(e => console.log(e))
