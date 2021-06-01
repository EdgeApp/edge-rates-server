import fetch from 'node-fetch'

import { config } from './config'
import { ONE_MINUTE } from './utils/constants'
import { snooze } from './utils/utils'

const { cryptoCurrencyCodes, fiatCurrencyCodes, ratesServerAddress } = config

const endPoint = `${ratesServerAddress}/v1/exchangeRates`

const allCurrencies = cryptoCurrencyCodes.concat(fiatCurrencyCodes)
const bridgeCurrency = 'USD'

interface pairQuery {
  currency_pair: string
  date: string
}

export const ratesEngine = async (): Promise<void> => {
  const currentDate = new Date().toISOString()
  try {
    const data: pairQuery[] = []
    for (const currencyCode of allCurrencies) {
      data.push({
        currency_pair: `${currencyCode}_${bridgeCurrency}`,
        date: currentDate
      })
    }
    while (data.length > 0) {
      const response = await fetch(endPoint, {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({ data: data.splice(0, 100) })
      })
      if (response.ok === true) {
        console.log(`Successfully saved new currencyPairs`)
      } else {
        console.log(`Could not save new currencyPairs`)
      }
    }
  } catch (e) {
    console.log(currentDate)
    console.log(e)
  } finally {
    console.log('SNOOZING ***********************************')
    await snooze(ONE_MINUTE)
    ratesEngine().catch(e => console.log(e))
  }
}
