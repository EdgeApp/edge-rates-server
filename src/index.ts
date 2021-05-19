import cluster from 'cluster'
import {
  autoReplication,
  CouchSetup,
  forkChildren,
  makePeriodicTask,
  prepareCouch
} from 'edge-server-tools'
import http from 'http'

import { config } from './config'
import { makeServer } from './server'

const AUTOREPLICATION_DELAY = 1000 * 60 * 30 // 30 minutes

const couchSetup: CouchSetup = { db_rates: {} }

async function main(): Promise<void> {
  const {
    couchUri,
    httpPort = 8008,
    infoServerAddress,
    infoServerApiKey
  } = config
  if (cluster.isMaster) {
    // Make sure all couch databases are created
    await prepareCouch(couchUri, couchSetup)

    // Periodically configure database replication
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

    // Fork the child HTTP server processes
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

main().catch(err => {
  console.error(err)
  process.exit(1)
})
