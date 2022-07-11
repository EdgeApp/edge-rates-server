import fetch from 'node-fetch'

import { config } from './config'
import { ExchangeRateReq } from './exchangeRateRouter'
import { existsAsync, hgetallAsync, setAsync } from './uidEngine'
import { createThrottledMessage } from './utils/createThrottledMessage'
import { getEdgeAssetDoc } from './utils/dbUtils'
import { slackPoster } from './utils/postToSlack'
import { logger, normalizeDate, snooze } from './utils/utils'

const {
  cryptoCurrencyCodes,
  fiatCurrencyCodes,
  ratesServerAddress,
  preferredCryptoFiatPairs,
  defaultFiatCode: DEFAULT_FIAT
} = config

const endPoint = `${ratesServerAddress}/v2/exchangeRates`
const slackMessage = createThrottledMessage(
  { set: setAsync, exists: existsAsync },
  slackPoster
)

const LOOP_DELAY = 1000 * 30 // Delay 30 seconds
const bridgeCurrency = DEFAULT_FIAT

const getCurrencyCodeList = async (): Promise<string[]> => {
  // Try Redis first
  try {
    const allEdgeCurrenciesRedis: string[] = Object.values(
      await hgetallAsync('allEdgeCurrencies')
    )
    const fiatCurrencyCodesRedis: string[] = Object.values(
      await hgetallAsync('fiatCurrencyCodes')
    )
    if (
      allEdgeCurrenciesRedis.length === 0 ||
      fiatCurrencyCodesRedis.length === 0
    )
      throw new Error('Failed to find default currency code list in Redis')

    return [...allEdgeCurrenciesRedis, ...fiatCurrencyCodesRedis]
  } catch (e) {
    logger(e)
  }

  // If Redis lookup failed, try Couchdb
  try {
    const edgeDoc = await getEdgeAssetDoc()
    if (
      edgeDoc.allEdgeCurrencies.length === 0 ||
      edgeDoc.fiatCurrencyCodes.length === 0
    )
      throw new Error('Failed to find default currency code maps in couch')
    return [...edgeDoc.allEdgeCurrencies, ...edgeDoc.fiatCurrencyCodes]
  } catch (e) {
    logger(e)
  }

  // If Couchdb lookup failed, use local defaults
  return [...cryptoCurrencyCodes, ...fiatCurrencyCodes]
}

export const ratesEngine = async (): Promise<void> => {
  try {
    const currentDate = normalizeDate(new Date().toISOString())
    const allCurrencies = await getCurrencyCodeList()

    const data: ExchangeRateReq[] = [
      ...preferredCryptoFiatPairs.map(currency_pair => ({
        currency_pair,
        date: currentDate
      }))
    ]
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
    const message = `ratesEngine failure: ${e}`
    slackMessage(message).catch(e => logger(e))
    logger(message)
  } finally {
    logger('RATES ENGINE SNOOZING **********************')
    await snooze(LOOP_DELAY)
    ratesEngine().catch(e => logger(e))
  }
}
