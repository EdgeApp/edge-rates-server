// indexAuth.js
// BASE SETUP
// =============================================================================

import bodyParser from 'body-parser'
import { asArray, asObject } from 'cleaners'
import cors from 'cors'
import express from 'express'
import http from 'http'
import nano from 'nano'
import promisify from 'promisify-node'

import CONFIG from '../serverConfig.json'
import { asExchangeRateReq, getExchangeRate, ReturnRate } from './utils'
// const REQUIRED_CODES = ['BC1', 'DASH', 'LTC', 'BCH']

const asExchangeRatesReq = asObject({
  data: asArray(asExchangeRateReq)
})

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
  if (result.error != null) {
    return res.status(400).send(result.error)
  }
  res.json(result)
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

// START THE SERVER
// =============================================================================
const httpServer = http.createServer(app)

const { httpPort = 8008 } = CONFIG
httpServer.listen(CONFIG.httpPort, '127.0.0.1')

mylog(`Express server listening on port ${httpPort}`)
