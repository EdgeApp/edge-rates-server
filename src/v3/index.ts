import express from 'express'
import http from 'http'
import { pickMethod, pickPath } from 'serverlet'
import { makeExpressRoute } from 'serverlet/express'

import { config } from '../config'
import { findTokensV1, getTokenV1, listTokensV1 } from './getTokenInfo'
import { ratesV3 } from './router'

async function main(): Promise<void> {
  await server()
}

function server(): void {
  const server = pickPath({
    '/v1/getToken': pickMethod({ GET: getTokenV1 }),
    '/v1/findTokens': pickMethod({ GET: findTokensV1 }),
    '/v1/listTokens': pickMethod({ GET: listTokensV1 }),
    '/v3/rates': pickMethod({ POST: ratesV3 })
  })

  // Set up Express:
  const app = express()
  app.enable('trust proxy')
  app.use(express.json({ limit: '5mb' }))
  app.use('/', makeExpressRoute(server))

  // Start the HTTP server:
  const { httpHost, httpPort } = config
  const httpServer = http.createServer(app)
  httpServer.listen(httpPort, httpHost)
  console.log(`HTTP v3 server listening on port ${httpPort}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
