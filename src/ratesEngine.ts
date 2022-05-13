import fetch from 'node-fetch'

import { config } from './config'
import { hgetallAsync } from './uidEngine'
import { getEdgeAssetDoc } from './utils/dbUtils'
import { logger, normalizeDate, snooze } from './utils/utils'

const {
  cryptoCurrencyCodes,
  fiatCurrencyCodes,
  ratesServerAddress,
  defaultFiatCode: DEFAULT_FIAT
} = config

const endPoint = `${ratesServerAddress}/v2/exchangeRates`

const LOOP_DELAY = 1000 * 30 // Delay 30 seconds
const bridgeCurrency = DEFAULT_FIAT

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
    logger(
      `Could not get currency code list from Redis. Attempting to get it from DB.`
    )
    try {
      const edgeDoc = await getEdgeAssetDoc()
      currencyCodes = edgeDoc.allEdgeCurrencies.concat(
        edgeDoc.fiatCurrencyCodes
      )
    } catch (e) {
      logger(`Could not get currency code list from DB. Using defaults.`)
    }
  }
  return currencyCodes
}

export const ratesEngine = async (): Promise<void> => {
  const currentDate = normalizeDate(new Date().toISOString())
  const allCurrencies = await getCurrencyCodeList()

  try {
    const data: pairQuery[] = []
    for (const currencyCode of allCurrencies) {
      data.push({
        currency_pair: `${currencyCode}_${bridgeCurrency}`,
        date: currentDate
      })
    }
    const promises: Array<Promise<any>> = []
    while (data.length > 0) {
      promises.push(
        fetch(endPoint, {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST',
          body: JSON.stringify({ data: data.splice(0, 100) })
        }).catch(e => logger('ratesEngine query error', e))
      )
    }
    await Promise.all(promises)
  } catch (e) {
    logger('ratesEngine error: ', e)
  } finally {
    logger('RATES ENGINE SNOOZING **********************')
    await snooze(LOOP_DELAY)
    ratesEngine().catch(e => logger(e))
  }
}
