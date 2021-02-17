// indexAuth.js
// BASE SETUP
// =============================================================================

import bodyParser from 'body-parser'
import cors from 'cors'
import express from 'express'
import morgan from 'morgan'

import { router } from './router/router'

// call the packages we need
const app = express()

// Morgan Logging
app.use(
  morgan(
    ':date[iso] :method :url :status :res[content-length] - :response-time ms'
  )
)

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.json({ limit: '50mb' }))
// Return 400 error is body is not json
app.use((err, req, res, next) => {
  if (err != null) return res.status(400).send({ error: 'error parsing data' })
  return next()
})
// Parse the url query string
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))
// Allow cors
app.use(cors())

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/v1', router)

export { app }
