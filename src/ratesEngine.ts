import fetch from 'node-fetch'

import { config } from './config'
import { existsAsync, hgetallAsync } from './uidEngine'
import currencyCodeMaps from './utils/currencyCodeMaps.json'
import { getEdgeAssetDoc } from './utils/dbUtils'
import { snooze } from './utils/utils'

const {
  cryptoCurrencyCodes,
  fiatCurrencyCodes,
  ratesServerAddress,
  defaultFiatCode: DEFAULT_FIAT
} = config

const endPoint = `${ratesServerAddress}/v2/exchangeRates`

const UID_DELAY = 1000 * 60 * 60 * 24 // Delay 1 day
const LOOP_DELAY = 1000 * 60 // Delay 1 minute
const bridgeCurrency = DEFAULT_FIAT
let cacheUpdateTimestamp = Date.now()

interface pairQuery {
  currency_pair: string
  date: string
}

const getCurrencyCodeList = async (): Promise<string[]> => {
  let currencyCodes = cryptoCurrencyCodes.concat(fiatCurrencyCodes)
  try {
    const allEdgeCurrenciesRedis: string[] = Object.values(
      await hgetallAsync('allEdgeCurrencies')
    )
    const fiatCurrencyCodesRedis: string[] = Object.values(
      await hgetallAsync('fiatCurrencyCodes')
    )
    currencyCodes = [
      ...currencyCodes,
      ...allEdgeCurrenciesRedis,
      ...fiatCurrencyCodesRedis
    ]
  } catch (e) {
    console.log(
      `Could not get currency code list from Redis. Attempting to get it from DB.`
    )
    try {
      const edgeDoc = await getEdgeAssetDoc()
      currencyCodes = edgeDoc.allEdgeCurrencies.concat(
        edgeDoc.fiatCurrencyCodes
      )
    } catch (e) {
      console.log(`Could not get currency code list from DB. Using defaults.`)
    }
  }
  return currencyCodes
}

export const ratesEngine = async (): Promise<void> => {
  const headers = {
    'Content-Type': 'application/json'
  }
  const currentDate = new Date().toISOString()
  const allCurrencies = await getCurrencyCodeList()
  const keysExistPromises = Object.keys(currencyCodeMaps).map(async key =>
    existsAsync(key)
  )
  const redisKeysExist = await Promise.all(keysExistPromises)
  const msSinceLastUpdate = Date.now() - cacheUpdateTimestamp
  const cacheNeedsUpdate =
    redisKeysExist.includes(0) || msSinceLastUpdate > UID_DELAY
  try {
    const data: pairQuery[] = []
    for (const currencyCode of allCurrencies) {
      data.push({
        currency_pair: `${currencyCode}_${bridgeCurrency}`,
        date: currentDate
      })
    }
    while (data.length > 0) {
      if (data.length <= 100 && cacheNeedsUpdate) {
        headers['Cache-Control'] = 'no-cache'
        cacheUpdateTimestamp = Date.now()
        console.log('Cache to be updated')
      }
      const response = await fetch(endPoint, {
        headers,
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
