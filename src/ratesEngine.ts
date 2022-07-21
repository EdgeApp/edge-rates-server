import fetch from 'node-fetch'

import { config } from './config'
import { ExchangeRateReq } from './exchangeRateRouter'
import { existsAsync, hgetallAsync, setAsync } from './indexEngines'
import { createThrottledMessage } from './utils/createThrottledMessage'
import { getEdgeAssetDoc } from './utils/dbUtils'
import { slackPoster } from './utils/postToSlack'
import { logger, normalizeDate } from './utils/utils'

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

const bridgeCurrency = DEFAULT_FIAT

const getCurrencyCodeList = async (): Promise<string[]> => {
  // Try Redis first
  try {
    const allEdgeCurrenciesRedis: string[] = Object.values(
      await hgetallAsync('allEdgeCurrencies')
    )
    logger(
      `getCurrencyCodeList allEdgeCurrenciesRedis retrieved ${allEdgeCurrenciesRedis.length} pairs`
    )
    const fiatCurrencyCodesRedis: string[] = Object.values(
      await hgetallAsync('fiatCurrencyCodes')
    )
    logger(
      `getCurrencyCodeList fiatCurrencyCodesRedis retrieved ${fiatCurrencyCodesRedis.length} pairs`
    )
    if (
      allEdgeCurrenciesRedis.length === 0 ||
      fiatCurrencyCodesRedis.length === 0
    )
      throw new Error('Failed to find default currency code list in Redis')

    return [...allEdgeCurrenciesRedis, ...fiatCurrencyCodesRedis]
  } catch (e) {
    logger.error('getCurrencyCodeList redis error', e)
  }

  // If Redis lookup failed, try Couchdb
  try {
    const edgeDoc = await getEdgeAssetDoc()
    if (
      edgeDoc.allEdgeCurrencies.length === 0 ||
      edgeDoc.fiatCurrencyCodes.length === 0
    )
      throw new Error('Failed to find default currency code maps in couch')
    logger(`getCurrencyCodeList got pairs from getEdgeAssetDoc`)
    return [...edgeDoc.allEdgeCurrencies, ...edgeDoc.fiatCurrencyCodes]
  } catch (e) {
    logger.error('getCurrencyCodeList couchdb error', e)
  }

  // If Couchdb lookup failed, use local defaults
  return [...cryptoCurrencyCodes, ...fiatCurrencyCodes]
}

export const ratesEngine = async (): Promise<void> => {
  logger('RATES ENGINE STARTING **********************')
  try {
    const currentDate = normalizeDate(new Date().toISOString())
    const allCurrencies = await getCurrencyCodeList()
    logger(`ratesEngine requesting ${allCurrencies.length} pairs`)

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
        }).catch(e => logger.error('ratesEngine query error', e))
      )
    }
    await Promise.all(promises)
  } catch (e) {
    const message = `ratesEngine failure: ${e}`
    slackMessage(message).catch(e => logger.error('slackMessage error:', e))
    logger.error(message)
  } finally {
    logger('RATES ENGINE SNOOZING **********************')
  }
}

ratesEngine()
  .then(() => process.exit(0))
  .catch(e => logger('ratesEngineCronError', e))

process.on('SIGINT', () => logger.error('ratesEngine killed via SIGINT'))
