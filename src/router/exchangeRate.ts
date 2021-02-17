import nano from 'nano'
import promisify from 'promisify-node'

import CONFIG from '../../serverConfig.json'
import { getRates } from '../rates/rates'
import { asRateParam, asRatesParams } from '../types'
import { clean } from './cleaner'
import { saveDocuments } from './couchdb'

// Nano for CouchDB
// =============================================================================
const nanoDb = nano(CONFIG.dbFullpath)
const dbRates = nanoDb.db.use('db_rates')
promisify(dbRates)

const getRatesMiddleware = async function(req, res, next): Promise<void> {
  const { documents, results } = await getRates(req.params, dbRates)
  res.documents = documents
  res.results = results
  return next()
}

export const exchangeRate = [
  clean(asRateParam),
  getRatesMiddleware,
  saveDocuments(dbRates),
  (req, res) => res.json(res.results[0])
]

export const exchangeRates = [
  clean(asRatesParams),
  getRatesMiddleware,
  saveDocuments(dbRates),
  (req, res) => res.json(res.results)
]
