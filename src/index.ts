import http from 'http'

import CONFIG from '../serverConfig.json'
import { app } from './app'
import { logger } from './utils'

// START THE SERVER
// =============================================================================
const httpServer = http.createServer(app)

const { httpPort = 8008 } = CONFIG
httpServer.listen(httpPort, '127.0.0.1', () => {
  logger(`Express server listening on port ${httpPort}`)
})
