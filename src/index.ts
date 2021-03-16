// indexAuth.js
// BASE SETUP
// =============================================================================

import bodyParser from 'body-parser'
import { asArray, asObject } from 'cleaners'
import cluster from 'cluster'
import cors from 'cors'
import {
  autoReplication,
  forkChildren,
  makePeriodicTask,
  rebuildCouch
} from 'edge-server-tools'
import express from 'express'
import http from 'http'
import nano from 'nano'
import promisify from 'promisify-node'

import CONFIG from '../serverConfig.json'
import { asExchangeRateReq, getExchangeRate, ReturnRate } from './rates'
// const REQUIRED_CODES = ['BC1', 'DASH', 'LTC', 'BCH']

const asExchangeRatesReq = asObject({
  data: asArray(asExchangeRateReq)
})

const AUTOREPLICATION_DELAY = 1000 * 60 * 30 // 30 minutes
const EXCHANGE_RATES_BATCH_LIMIT = 100

// call the packages we need
const app = express()

const mylog = console.log

function dateString(): string {
  const date = new Date()
  return date.toDateString() + ':' + date.toTimeString()
}

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json({ limit: '50mb' }))
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))
app.use(cors())

// Nano for CouchDB
// =============================================================================
const nanoDb = nano(CONFIG.dbFullpath)
const dbRates = nanoDb.db.use('db_rates')
promisify(dbRates)

// ROUTES FOR OUR API
// =============================================================================
const router = express.Router()

// middleware to use for all requests
router.use(function(req, res, next) {
  // do logging

  mylog('Something is happening.')
  next() // make sure we go to the next routes and don't stop here
})

/*
 * Query params:
 * currency_pair: String with the two currencies separated by an underscore. Ex: "ETH_USD"
 */
router.get('/exchangeRate', async function(req, res) {
  const result = await getExchangeRate(req.query, dbRates)
  if (result.data.error != null) {
    return res.status(400).send(result.data.error)
  }
  if (result.document != null) {
    await dbRates.insert(result.document).catch(e => {
      console.log(e)
    })
  }
  res.json(result.data)
})

router.post('/exchangeRates', async function(req, res) {
  let queryResult
  try {
    queryResult = asExchangeRatesReq(req.body)
  } catch (e) {
    return res.status(400).send(`Missing Request fields.`)
  }
  if (queryResult.data.length > EXCHANGE_RATES_BATCH_LIMIT) {
    return res
      .status(400)
      .send(`Exceeded Limit of ${EXCHANGE_RATES_BATCH_LIMIT}`)
  }
  const returnedRates: Array<Promise<ReturnRate>> = []
  for (const exchangeRateLookup of queryResult.data) {
    returnedRates.push(getExchangeRate(exchangeRateLookup, dbRates))
  }

  const data = await Promise.all(returnedRates)
  let mergedDoc = {}
  for (const rateQuery of data) {
    if (rateQuery.document != null) {
      mergedDoc = { ...mergedDoc, ...rateQuery.document }
      delete rateQuery.document
    }
  }
  if (Object.keys(mergedDoc).length !== 0) {
    await dbRates.insert(mergedDoc).catch(e => {
      console.log(e)
    })
  }
  res.json({ data })
})

// middleware to use for all requests
router.use(function(req, res, next) {
  // do logging
  mylog(dateString() + 'Something is happening.')
  next() // make sure we go to the next routes and don't stop here
})

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/v1', router)

async function main(): Promise<void> {
  const {
    httpPort = 8008,
    infoServerAddress,
    infoServerApiKey,
    hostname = '127.0.0.1',
    dbUsername,
    dbPassword
  } = CONFIG
  if (cluster.isMaster) {
    // rebuildCouch(myCouchSetupData)
    makePeriodicTask(async () => 
      await autoReplication(
        infoServerAddress,
        'ratesServer',
        infoServerApiKey,
        hostname,
        dbUsername,
        dbPassword
      ),
      AUTOREPLICATION_DELAY
    )
    forkChildren()
  } else {
  // START THE SERVER
  // =============================================================================
  const httpServer = http.createServer(app)
  httpServer.listen(httpPort, '127.0.0.1')

  mylog(`Express server listening on port ${httpPort}`)
  }
}

main().catch(e => console.log(e))
