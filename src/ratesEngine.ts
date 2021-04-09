import fetch from 'node-fetch'

import { config } from './config'
import { snooze } from './utils'

const { cryptoCurrencyCodes, fiatCurrencyCodes, ratesServerAddress } = config

const endPoint = `${ratesServerAddress}/v1/exchangeRates`

const LOOP_DELAY = 1000 * 60 * 10 // Delay 10 minutes
const allCurrencies = cryptoCurrencyCodes.concat(fiatCurrencyCodes)
const bridgeCurrency = 'USD'

interface pairQuery {
  currency_pair: string
  date: string
}

const ratesEngine = async (): Promise<void> => {
  const currentDate = new Date().toISOString()
  try {
    const data: pairQuery[] = []
    for (const currencyCode of allCurrencies) {
      data.push({
        currency_pair: `${bridgeCurrency}_${currencyCode}`,
        date: currentDate
      })
    }
    const response = await fetch(endPoint, {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify({ data })
    })
    if (response.ok === true) {
      console.log(`Successfully saved new currencyPairs`)
    } else {
      console.log(`Could not save new currencyPairs`)
    }
  } catch (e) {
    console.log(currentDate)
    console.log(e)
  } finally {
    console.log('SNOOZING ***********************************')
    await snooze(LOOP_DELAY)
    ratesEngine().catch(e => console.log(e))
  }
}

ratesEngine().catch(e => console.log(e))
