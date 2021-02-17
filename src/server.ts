import bodyParser from 'body-parser'
import compression from 'compression'
import cors from 'cors'
import express from 'express'
import morgan from 'morgan'
import nano from 'nano'
import promisify from 'promisify-node'

import { router } from './router/router'
import { ServerConfig } from './types'
import { SlackPoster } from './utils'
const RouteError = {
  message: 'Endpoint not found',
  errorType: 'bad_query',
  errorCode: 404
}
const MorganTemplate =
  ':date[iso] :method :url :status :res[content-length] - :response-time ms'

export const createServer = (config: ServerConfig): express.Application => {
  const { dbFullpath, dbName } = config
  const app = express()
  // Gzip compression
  app.use(compression())
  // Create throttled slack poster
  const postToSlack = SlackPoster(config.slackWebhookUrl)
  const localDB = promisify(nano(dbFullpath).db.use(dbName))
  app.set('localDB', localDB)
  // Set local app params
  app.set('httpPort', config.httpPort)
  app.set('httpHost', config.httpHost)
  // Morgan Logging
  app.use(morgan(MorganTemplate))
  // configure app to use bodyParser() and return 400 error is body is not json
  app.use(bodyParser.json({ limit: '50mb' }))
  app.use((err, _req, res, next) => {
    if (err == null) return next()
    res.status(400).send({ error: 'error parsing data' })
  })
  // Parse the url string
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))
  // Allow cors
  app.use(cors())
  // Add router to /v1
  app.use('/v1', router)
  // 404 Error Route
  app.use((_req, _res, next) => next(RouteError))
  // Catch and handle errors
  app.use((err, _req, res, _next) => {
    // Notify slack about critical errors with the database (db is down, connection issues, etc).
    if (err.errorType === 'db_error') postToSlack(err).catch(e => e)
    res.status(err.errorCode ?? 500).json({ error: err })
  })

  return app
}
