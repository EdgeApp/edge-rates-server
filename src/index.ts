import cluster from 'cluster'
import {
  autoReplication,
  forkChildren,
  makePeriodicTask
} from 'edge-server-tools'
import http from 'http'

import { config } from './config'
import { makeServer } from './server'

const AUTOREPLICATION_DELAY = 1000 * 60 * 30 // 30 minutes

function main(): void {
  const {
    couchUri,
    httpPort = 8008,
    infoServerAddress,
    infoServerApiKey
  } = config
  if (cluster.isMaster) {
    makePeriodicTask(
      async () =>
        autoReplication(
          infoServerAddress,
          'ratesServer',
          infoServerApiKey,
          couchUri
        ),
      AUTOREPLICATION_DELAY
    )
    forkChildren()
  } else {
    // START THE SERVER
    // =============================================================================
    const app = makeServer()
    const httpServer = http.createServer(app)
    httpServer.listen(httpPort, '127.0.0.1')

    console.log(`Express server listening on port ${httpPort}`)
  }
}

main()
