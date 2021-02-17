import bodyParser from 'body-parser'
import cors from 'cors'
import express, { Express } from 'express'
import morgan from 'morgan'

import { router } from './router/router'
import { ServerConfig } from './types'

const MorganTemplate =
  ':date[iso] :method :url :status :res[content-length] - :response-time ms'

export const createServer = ({
  httpPort = 8008,
  httpHost = '127.0.0.1'
}: ServerConfig): Express => {
  // call the packages we need
  const app = express()
  // Set local app params
  app.set('httpPort', httpPort)
  app.set('httpHost', httpHost)
  // Morgan Logging
  app.use(morgan(MorganTemplate))
  // configure app to use bodyParser() and return 400 error is body is not json
  app.use(bodyParser.json({ limit: '50mb' }))
  app.use((err, _req, res, next) =>
    err == null ? next() : res.status(400).send({ error: 'error parsing data' })
  )
  // Parse the url query string
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))
  // Allow cors
  app.use(cors())
  // Add router to /v1
  app.use('/v1', router)
  return app
}
