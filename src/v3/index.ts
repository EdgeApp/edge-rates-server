import express from 'express'
import http from 'http'
import { pickMethod, pickPath } from 'serverlet'
import { makeExpressRoute } from 'serverlet/express'

import { config } from '../config'
import {
  ratesV2,
  rateV2,
  sendCoinrankAssetV2,
  sendCoinrankListV2,
  sendCoinranksV2
} from './legacyRouter'
import { heartbeatV3, ratesV3 } from './router'

async function main(): Promise<void> {
  server()
}

function server(): void {
  const server = pickPath({
    '/': pickMethod({ GET: heartbeatV3 }),
    '/v2/exchangeRate': pickMethod({ GET: rateV2 }),
    '/v2/exchangeRates': pickMethod({ POST: ratesV2 }),
    '/v2/coinrank': pickMethod({ GET: sendCoinranksV2 }),
    '/v2/coinrankAsset/([^/]+)': pickMethod({ GET: sendCoinrankAssetV2 }),
    '/v2/coinrankList': pickMethod({ GET: sendCoinrankListV2 }),
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
