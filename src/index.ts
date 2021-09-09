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
  // v1 API consumer sends currency codes without any prefixes and the server makes a best guess at the type using a local list of fiat codes before passing to data providers
  '/v1': exchangeRateRouterV1(),
  // v2 API consumer indicates currency code type in the request by prefixing fiat codes with "iso:"
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
