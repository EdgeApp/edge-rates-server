import fetch from 'node-fetch'

import { config } from './config'
import { getEdgeAssetDoc } from './utils/dbUtils'
import { snooze } from './utils/utils'

const {
  cryptoCurrencyCodes,
  fiatCurrencyCodes,
  ratesServerAddress,
  defaultFiatCode: DEFAULT_FIAT
} = config

const endPoint = `${ratesServerAddress}/v1/exchangeRates`

const LOOP_DELAY = 1000 * 60 // Delay 1 minute
const bridgeCurrency = DEFAULT_FIAT

interface pairQuery {
  currency_pair: string
  date: string
}

const getCurrencyCodeList = async (): Promise<string[]> => {
  let currencyCodes = cryptoCurrencyCodes.concat(fiatCurrencyCodes)
  try {
    const edgeDoc = await getEdgeAssetDoc()
    currencyCodes = edgeDoc.allEdgeCurrencies.concat(edgeDoc.fiatCurrencyCodes)
  } catch (e) {
    console.log(`Could not get currency code list from DB. Using defaults.`)
  }
  return currencyCodes
}

export const ratesEngine = async (): Promise<void> => {
  const currentDate = new Date().toISOString()
  const allCurrencies = await getCurrencyCodeList()
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
    await snooze(LOOP_DELAY)
    ratesEngine().catch(e => console.log(e))
  }
}
