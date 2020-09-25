// indexAuth.js
// BASE SETUP
// =============================================================================

import { bns } from 'biggystring'
import bodyParser from 'body-parser'
import cors from 'cors'
import express from 'express'
import http from 'http'
import nano from 'nano'
import promisify from 'promisify-node'

import CONFIG from '../serverConfig.json'
import { coincapHistorical } from './coincap'
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

async function getFromDb(
  currencyA: string,
  currencyB: string,
  date: string,
  log: Function
): Promise<string> {
  let rate = ''
  try {
    const exchangeRate: nano.DocumentGetResponse & {
      [pair: string]: any
    } = await dbRates.get(date)
    if (exchangeRate[`${currencyA}_${currencyB}`] != null) {
      rate = exchangeRate[`${currencyA}_${currencyB}`]
    } else if (exchangeRate[`${currencyB}_${currencyA}`] != null) {
      rate = bns.div('1', exchangeRate[`${currencyB}_${currencyA}`], 8, 10)
    }
  } catch (e) {
    if (e.error !== 'not_found') {
      log(`DB read error ${JSON.stringify(e)}`)
      throw e
    }
  }
  return rate
}

const zeroRateCurrencyCodes = {
  UFO: true,
  FORK: true
}

const fallbackConstantRatePairs = {
  SAI_USD: 1,
  DAI_USD: 1
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
  const log = (...args): void => {
    const d = new Date().toISOString()
    const p = currencyPair
    console.log(`${d} ${p} ${JSON.stringify(args)}`)
  }
  let rate = ''
  let needsWrite = true
  if (
    zeroRateCurrencyCodes[currencyA] === true ||
    zeroRateCurrencyCodes[currencyB] === true
  ) {
    rate = '0'
    needsWrite = false
  }
  try {
    if (rate === '') {
      rate = await getFromDb(currencyA, currencyB, dateNorm, log)
      if (rate !== '') needsWrite = false
    }
    if (rate === '') {
      rate = await currencyConverter(currencyA, currencyB, dateNorm, log)
    }
    if (rate === '' && hasDate === false) {
      rate = await coinMarketCapCurrent(currencyA, currencyB, log)
    }
    if (rate === '') {
      rate = await coincapHistorical(currencyA, currencyB, dateNorm, log)
    }
    if (rate === '') {
      rate = await coinMarketCapHistorical(currencyA, currencyB, dateNorm, log)
    }
  } catch (e) {
    postToSlack(dateNorm, `exchangeRate query failed ${e.message}`).catch(e)
    return res.status(500).json({ error: 'rates1 exchangeRate query failed' })
  }

  // Use fallback hardcoded rates if lookups failed
  if (
    rate === '' &&
    fallbackConstantRatePairs[`${currencyA}_${currencyB}`] != null
  ) {
    rate = fallbackConstantRatePairs[`${currencyA}_${currencyB}`]
  }

  if (
    rate === '' &&
    fallbackConstantRatePairs[`${currencyB}_${currencyA}`] != null
  ) {
    rate = fallbackConstantRatePairs[`${currencyB}_${currencyA}`]
  }

  // Return error if everything failed
  if (rate === '') {
    return res.status(500).json({ error: 'All lookups failed to find rate' })
  }

  if (needsWrite) {
    let newDocument: nano.DocumentGetResponse = {
      _id: dateNorm,
      _rev: '',
      [currencyPair]: rate
    }
    const existingDocument = await dbRates.get(dateNorm).catch(e => {
      if (e.error !== 'not_found')
        log(`DB existing doc read error ${JSON.stringify(e)}`)
    })
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
    let writeSuccess = true
    dbRates.insert(writeDocument).catch(e => {
      writeSuccess = false
      if (e.error !== 'conflict') {
        postToSlack(
          dateNorm,
          `rates1 exchangeRate DB write error ${e.reason}`
        ).catch(e)
      }
      log(`DB write error ${JSON.stringify(e)}`)
    })
    if (writeSuccess) log(`Successfully saved ${writeDocument._id} to db`)
  }
  return res.json({
    currency_pair: currencyPair,
    date: dateNorm,
    exchangeRate: rate
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
