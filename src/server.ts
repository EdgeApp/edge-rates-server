import bodyParser from 'body-parser'
import compression from 'compression'
import cors from 'cors'
import express from 'express'
import morgan from 'morgan'

import { HttpConfig } from './types/types'

const BodyParseError = {
  message: 'error parsing body data',
  errorType: 'bad_query',
  errorCode: 400
}

const RouteError = {
  message: 'Endpoint not found',
  errorType: 'bad_query',
  errorCode: 404
}
const MorganTemplate =
  ':date[iso] :method :url :status :res[content-length] - :response-time ms'

export const createServer = (
  router: express.Router,
  { httpPort, httpHost }: HttpConfig
): express.Application => {
  const app = express()
  // Gzip compression
  app.use(compression())
  // Create throttled slack poster
  // Set local app params
  app.set('httpPort', httpPort)
  app.set('httpHost', httpHost)
  // Morgan Logging
  app.use(morgan(MorganTemplate))
  // configure app to use bodyParser() and return 400 error is body is not json
  app.use(bodyParser.json({ limit: '50mb' }))
  app.use((err, _req, _res, next) => next(err != null ? BodyParseError : null))
  // Parse the url string
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))
  // Allow cors
  app.use(cors())
  // Add router to the app
  app.use(router)
  // 404 Error Route
  app.use((_req, _res, next) => next(RouteError))
  // Catch and handle errors
  app.use((err, _req, res, _next) => {
    res.status(err.errorCode ?? 500).json({ error: err })
  })

  return app
}
