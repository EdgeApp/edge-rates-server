import fetch from 'node-fetch'
import { createClient } from 'redis'

import { config } from './config'
import { REDIS_COINRANK_KEY_PREFIX } from './constants'
import { asCoingeckoMarkets, CoinrankRedis } from './types'
import { setAsync, slackMessage } from './utils/dbUtils'
import { logger, snooze } from './utils/utils'

const client = createClient()
client.connect().catch(e => logger('redis connect error: ', e))

const PAGE_SIZE = 250
const LOOP_DELAY = 45000

export const coinrankEngine = async (): Promise<void> => {
  await console.log('hello')

  logger('Updating Coinrank Cache')
  try {
    const lastUpdate = new Date().toISOString()
    const { uri } = config.providers.coingecko
    let markets: any = []
    for (let page = 1; page <= 8; page++) {
      const url = `${uri}/api/v3/coins/markets?vs_currency=USD&page=${page}&per_page=${PAGE_SIZE}&price_change_percentage=1h,24h,7d,14d,30d,1y`
      const response = await fetch(url)
      if (response.ok === false) {
        const text = await response.text()
        throw new Error(text)
      }
      const reply = await response.json()
      try {
        const marketsPage = asCoingeckoMarkets(reply)
        markets = [...markets, ...marketsPage]
      } catch (e) {
        console.log('ugh')
      }
    }
    const data: CoinrankRedis = { lastUpdate, markets }
    await setAsync(`${REDIS_COINRANK_KEY_PREFIX}_USD`, JSON.stringify(data))
  } catch (e) {
    const err: any = e // Weird TS issue causing :any to get removed from above line
    const message = `coinrankEngine failure: ${err.message}`
    slackMessage(message).catch(e => logger(e))
    logger(message)
  } finally {
    logger('COINRANK ENGINE SNOOZING **********************')
    await snooze(LOOP_DELAY)
    coinrankEngine().catch(e => logger(e))
  }
}
