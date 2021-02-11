// indexAuth.js
// BASE SETUP
// =============================================================================

import bodyParser from 'body-parser'
import { asArray, asObject } from 'cleaners'
import cors from 'cors'
import express from 'express'
import http from 'http'
import morgan from 'morgan'
import nano from 'nano'
import promisify from 'promisify-node'

import CONFIG from '../serverConfig.json'
import { asExchangeRateReq, getExchangeRate, ReturnRate } from './rates'
import { log } from './utils'

const asExchangeRatesReq = asObject({
  data: asArray(asExchangeRateReq)
})

const EXCHANGE_RATES_BATCH_LIMIT = 100

// call the packages we need
const app = express()

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json({ limit: '50mb' }))
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))
app.use(cors())

app.use(
  morgan(
    ':date[iso] :method :url :status :res[content-length] - :response-time ms'
  )
)

// Nano for CouchDB
// =============================================================================
const nanoDb = nano(CONFIG.dbFullpath)
const dbRates = nanoDb.db.use('db_rates')
promisify(dbRates)

// ROUTES FOR OUR API
// =============================================================================
const router = express.Router()

/*
 * Query params:
 * currency_pair: String with the two currencies separated by an underscore. Ex: "ETH_USD"
 */
router.get('/exchangeRate', async function(req, res) {
  const result = await getExchangeRate(req.query, dbRates)
  if (result.document != null) {
    dbRates
      .insert(result.document)
      .then(() => {
        log('Saved new document', result.document)
      })
      .catch(e => {
        log('/exchangeRate error', e)
      })
  }
  if (result.error != null) {
    return res.status(400).send(result.error)
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

  const allRates = await Promise.all(returnedRates)
  let mergedDoc = {}
  for (const rateQuery of allRates) {
    if (rateQuery.document != null) {
      mergedDoc = { ...mergedDoc, ...rateQuery.document }
    }
  }
  if (Object.keys(mergedDoc).length !== 0) {
    dbRates
      .insert(mergedDoc)
      .then(() => {
        log('Saved new document', mergedDoc)
      })
      .catch(e => {
        log('/exchangeRates error', e)
      })
  }
  const result = allRates.map(({ data }) => ({ ...data }))
  res.json(result)
})

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/v1', router)

// START THE SERVER
// =============================================================================
const httpServer = http.createServer(app)

const { httpPort = 8008 } = CONFIG
httpServer.listen(CONFIG.httpPort, '127.0.0.1')

log(`Express server listening on port ${httpPort}`)
