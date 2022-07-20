import { setupDatabase } from 'edge-server-tools'
import { createClient } from 'redis'

import { config } from './config'
import { ratesEngine } from './ratesEngine'
import { uidEngine } from './uidEngine'
import { ratesDbSetup } from './utils/dbUtils'
import { logger } from './utils/utils'

// Initialize Redis
const client = createClient()
client.connect().catch(e => logger('redis connect error: ', e))

client.on('error', function(error) {
  logger('redis client error', error)
})

export const hsetAsync = client.hSet.bind(client)
export const hgetallAsync = client.hGetAll.bind(client)
export const hmgetAsync = client.hmGet.bind(client)
export const existsAsync = client.exists.bind(client)
export const delAsync = client.del.bind(client)
// Set type to `any` to avoid the TS4023 error
export const setAsync: any = client.set.bind(client)

// Initialize DB
async function initDb(): Promise<void> {
  await setupDatabase(config.couchUri, ratesDbSetup)
  ratesEngine().catch(e => logger('ratesEnginee failure', e))
  uidEngine().catch(e => logger('uidEnginee failure', e))
}

initDb().catch(e => logger('initDbe failure', e))
