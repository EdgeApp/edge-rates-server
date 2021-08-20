import { config } from './config'
import {
  exchangeRateRouterV1,
  exchangeRateRouterV2
} from './exchangeRateRouter'
import { createRouter } from './router'
import { createServer } from './server'
import { logger } from './utils/utils'

// Create Router
const router = createRouter({
  // Create Exchange Rate Router
  '/v1': exchangeRateRouterV1(),
  '/v2': exchangeRateRouterV2()
})
// Create Server
const server = createServer(router, config)
// Start Server
server.listen(server.get('httpPort'), server.get('httpHost'), () => {
  logger(
    `Express server listening on port ${JSON.stringify(server.get('httpPort'))}`
  )
})
