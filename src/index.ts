import { setupDatabase } from 'edge-server-tools'

import { config } from './config'
import { exchangeRateRouter } from './exchangeRateRouter'
import { createRouter } from './router'
import { createServer } from './server'
import { ratesDbSetup } from './utils/dbUtils'
import { logger } from './utils/utils'

// Initialize DB
async function initDb(): Promise<void> {
  await setupDatabase(config.couchUri, ratesDbSetup)
}

initDb().catch(e => console.log(e))

// Create Router
const router = createRouter({
  // Create Exchange Rate Router
  '/v1': exchangeRateRouter(config)
})
// Create Server
const server = createServer(router, config)
// Start Server
server.listen(server.get('httpPort'), server.get('httpHost'), () => {
  logger(
    `Express server listening on port ${JSON.stringify(server.get('httpPort'))}`
  )
})
