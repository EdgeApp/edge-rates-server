// indexAuth.js
// BASE SETUP
// =============================================================================

import bodyParser from 'body-parser'
import cors from 'cors'
import express from 'express'
import http from 'http'
import nano from 'nano'
import promisify from 'promisify-node'

import CONFIG from '../serverConfig.json'
import { coinMarketCapHistorical } from './coinMarketCap'
import { coinMarketCapCurrent } from './coinMarketCapBasic'
import { currencyConverter } from './currencyConverter'
import { normalizeDate, postToSlack } from './utils'
// const REQUIRED_CODES = ['BC1', 'DASH', 'LTC', 'BCH']

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

interface ExResponse {
  rate: string
  needsWrite: boolean
}

export type ExchangeResponse = ExResponse | void

async function getFromDb(
  currencyPair: string,
  date: string
): Promise<ExchangeResponse> {
  try {
    const exchangeRate: nano.DocumentGetResponse & {
      [pair: string]: any
    } = await dbRates.get(date)
    if (exchangeRate[currencyPair] == null) {
      return
    }
    return { rate: exchangeRate[currencyPair], needsWrite: false }
  } catch (e) {
    if (e.error !== 'not_found') {
      console.log('DB read error', e)
      throw e
    }
  }
}

/*
 * Query params:
 * currency_pair: String with the two currencies separated by an underscore. Ex: "ETH_USD"
 */
router.get('/exchangeRate', async function(req, res) {
  let hasDate = false
  let dateStr: string
  const currencyPair = req.query.currency_pair
  if (typeof req.query.date === 'string') {
    dateStr = req.query.date
    hasDate = true
  } else {
    dateStr = new Date().toISOString()
  }
  mylog(`API /exchangeRate query: currencyPair:${currencyPair} date:${dateStr}`)
  if (typeof currencyPair !== 'string' || typeof dateStr !== 'string') {
    return res.status(400).json({
      error:
        'Missing or invalid query param(s): currency_pair and date should both be strings'
    })
  }
  const currencyTokens = currencyPair.split('_')
  if (currencyTokens.length !== 2) {
    return res.status(400).json({
      error:
        'currency_pair query param malformed.  should be [curA]_[curB], ex: "ETH_USD"'
    })
  }
  const currencyA = currencyTokens[0]
  const currencyB = currencyTokens[1]
  const dateNorm = normalizeDate(currencyA, currencyB, dateStr)
  if (dateNorm == null) {
    return res.status(400).json({
      error:
        'date query param malformed.  should be conventional date string, ex:"2019-11-21T15:28:21.123Z"'
    })
  }
  if (Date.parse(dateNorm) > Date.now()) {
    return res
      .status(400)
      .json({ error: 'Future date received. Must send past date.' })
  }
  let response: ExchangeResponse
  try {
    response = await getFromDb(currencyPair, dateNorm)
    if (response == null) {
      response = await currencyConverter(currencyA, currencyB, dateNorm)
    }
    if (response == null && hasDate === false) {
      response = await coinMarketCapCurrent(currencyA, currencyB)
    }
    if (response == null) {
      response = await coinMarketCapHistorical(currencyA, currencyB, dateNorm)
    }
    if (response == null) {
      return res.status(500).json({ error: 'All lookups failed to find rate' })
    }
  } catch (e) {
    postToSlack(dateNorm, `exchangeRate query failed ${e.message}`).catch(e)
    return res.status(500).json({ error: 'rates1 exchangeRate query failed' })
  }
  if (Date.parse(dateNorm) > Date.now()) {
    return res
      .status(400)
      .json({ error: 'Future date received. Must send past date.' })
  }
  if (response.needsWrite) {
    let newDocument: nano.DocumentGetResponse = {
      _id: dateNorm,
      _rev: '',
      [currencyPair]: response.rate
    }
    const existingDocument = await dbRates
      .get(dateNorm)
      .catch(e => console.log('DB read error', JSON.stringify(e)))
    if (existingDocument != null) {
      newDocument = {
        ...existingDocument,
        ...newDocument,
        _rev: existingDocument._rev
      }
    }
    const writeDocument = {
      ...newDocument,
      _rev: newDocument._rev !== '' ? newDocument._rev : undefined
    }
    console.log(JSON.stringify(`\n${JSON.stringify(writeDocument)}\n`))
    dbRates.insert(writeDocument).catch(e => {
      if (e.error !== 'conflict') {
        postToSlack(
          dateNorm,
          `rates1 exchangeRate DB write error ${e.reason}`
        ).catch(e)
      }
      console.log('DB write error', e)
    })
  }
  return res.json({
    currency_pair: currencyPair,
    date: dateNorm,
    exchangeRate: response.rate
  })
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
