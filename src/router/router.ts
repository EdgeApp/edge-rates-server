import express from 'express'

import { exchangeRate, exchangeRates } from './exchangeRate'

const router = express.Router()

router.get('/exchangeRate', exchangeRate)
router.post('/exchangeRates', exchangeRates)

export { router }
