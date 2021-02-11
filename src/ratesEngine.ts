import fetch from 'node-fetch'

import {
  cryptoCurrencyCodes,
  fiatCurrencyCodes,
  ratesServerAddress
} from '../serverConfig.json'
import { log, snooze } from './utils'

const endPoint = `${ratesServerAddress}/v1/exchangeRates`

const LOOP_DELAY = 1000 * 60 * 5 // Delay 5 minutes
const allCurrencies = cryptoCurrencyCodes.concat(fiatCurrencyCodes)
const bridgeCurrency = 'USD'

interface PairBody {
  [currencyPair: string]: string
}

const ratesEngine = async (): Promise<void> => {
  const currentDate = new Date().toISOString()
  try {
    const data: PairBody = allCurrencies.reduce(
      (body, currencyCode) =>
        Object.assign(body, {
          [`${currencyCode}_${bridgeCurrency}`]: currentDate
        }),
      {}
    )
    const response = await fetch(endPoint, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: JSON.stringify(data)
    })
    if (response.ok === true) {
      log(`Successfully saved new currencyPairs`)
      const responseObj = await response.json()
      log('All currency pair results', responseObj)
    } else {
      log(`Could not save new currencyPairs`)
    }
  } catch (e) {
    log(currentDate)
    log(e)
  } finally {
    log('SNOOZING ***********************************')
    await snooze(LOOP_DELAY)
    ratesEngine().catch(e => log(e))
  }
}

ratesEngine().catch(e => log(e))
