import fetch from 'node-fetch'

import { config } from './config'
import { ServerConfig } from './types'
import { logger, snooze } from './utils'

const LOOP_DELAY = 1000 * 60 * 5 // Delay 5 minutes

const fixedCurrency = 'USD'

interface PairBody {
  [currencyPair: string]: string
}

const ratesEngineInit = async (opts: ServerConfig = config): Promise<void> => {
  const { cryptoCurrencyCodes, fiatCurrencyCodes, ratesServerAddress } = opts
  const endPoint = `${ratesServerAddress}/v1/exchangeRates`
  const allCurrencies = cryptoCurrencyCodes.concat(fiatCurrencyCodes)
  return ratesEngine(endPoint, allCurrencies)
}

const ratesEngine = async (endPoint, allCurrencies): Promise<void> => {
  const currentDate = new Date().toISOString()
  try {
    const data: PairBody = allCurrencies.map(currencyCode => ({
      currency_pair: `${currencyCode}_${fixedCurrency}`,
      date: currentDate
    }))

    const response = await fetch(endPoint, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: JSON.stringify(data)
    })
    const responseObj = await response.json()
    if (response.ok === true) {
      logger('Successfully saved new currencyPairs', responseObj)
    } else {
      logger('Could not save new currencyPairs', responseObj)
    }
  } catch (e) {
    logger(currentDate)
    logger(e)
  } finally {
    logger('SNOOZING ***********************************')
    await snooze(LOOP_DELAY)
    ratesEngine(endPoint, allCurrencies).catch(e => logger(e))
  }
}

ratesEngineInit().catch(e => logger(e))
