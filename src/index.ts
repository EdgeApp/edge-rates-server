import { createServer } from './app'
import { config } from './config'
import { logger } from './utils'
// Create Server
const server = createServer(config)
// Start Server
server.listen(server.get('httpPort'), server.get('httpHost'), () => {
  logger(`Express server listening on port ${server.get('httpPort')}`)
})
