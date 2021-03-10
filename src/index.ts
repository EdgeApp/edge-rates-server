import { exchangeRateRouter } from './exchangeRate/exchangeRate'
import { createRouter } from './router/router'
import { createServer } from './server'
import { config } from './utils/config'
import { logger } from './utils/utils'

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
