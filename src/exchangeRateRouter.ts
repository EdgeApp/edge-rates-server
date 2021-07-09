// indexAuth.js
// BASE SETUP
// =============================================================================

import { asArray, asObject } from 'cleaners'
import express from 'express'
import nano from 'nano'
import promisify from 'promisify-node'

import { asConfig } from './config'
import { asExchangeRateReq, getExchangeRates } from './rates'
import { EXCHANGE_RATES_BATCH_LIMIT } from './utils/constants'

export const asExchangeRatesReq = asObject({
  data: asArray(asExchangeRateReq)
})

export const exchangeRateRouter = (
  config: ReturnType<typeof asConfig>
): express.Router => {
  // ROUTES FOR OUR API
  // =============================================================================
  const router = express.Router()

  // Nano for CouchDB
  // =============================================================================
  const nanoDb = nano(config.couchUri)
  const dbRates = nanoDb.db.use('db_rates')
  promisify(dbRates)

  /*
   * Query params:
   * currency_pair: String with the two currencies separated by an underscore. Ex: "ETH_USD"
   */
  router.get('/exchangeRate', async function(req, res) {
    const currencyPair = req.query.currency_pair
    const date = req.query.date
    let query
    try {
      query = asExchangeRatesReq({
        data: [{ currency_pair: currencyPair, date }]
      })
    } catch (e) {
      return res.status(400).send(`Missing Request fields.`)
    }

    const result = await getExchangeRates(query.data, dbRates, req.assetMaps)
    res.json(result.data[0])
  })

  router.post('/exchangeRates', async function(req, res) {
    let query
    try {
      query = asExchangeRatesReq(req.body)
    } catch (e) {
      return res.status(400).send(`Missing Request fields.`)
    }
    if (query.data.length > EXCHANGE_RATES_BATCH_LIMIT) {
      return res
        .status(400)
        .send(`Exceeded Limit of ${EXCHANGE_RATES_BATCH_LIMIT}`)
    }

    const requestedRates: Array<ReturnType<typeof asExchangeRateReq>> =
      query.data
    const data = await getExchangeRates(requestedRates, dbRates, req.assetMaps)
    res.json({ data: data.data })
  })

  return router
}
