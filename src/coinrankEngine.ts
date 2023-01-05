import fetch from 'node-fetch'

import { config } from './config'
import { REDIS_COINRANK_KEY_PREFIX } from './constants'
import { asCoingeckoMarkets, CoinrankMarkets, CoinrankRedis } from './types'
import { setAsync, slackMessage } from './utils/dbUtils'
import { logger, snooze } from './utils/utils'

const PAGE_SIZE = 250
const LOOP_DELAY = 45000
const { defaultFiatCode } = config

export const coinrankEngine = async (): Promise<void> => {
  logger('Updating Coinrank Cache')
  try {
    const lastUpdate = new Date().toISOString()
    const { uri } = config.providers.coingecko
    let markets: CoinrankMarkets = []
    for (let page = 1; page <= 8; page++) {
      const url = `${uri}/api/v3/coins/markets?vs_currency=USD&page=${page}&per_page=${PAGE_SIZE}&price_change_percentage=1h,24h,7d,14d,30d,1y`
      const response = await fetch(url)
      if (response.ok === false) {
        const text = await response.text()
        throw new Error(text)
      }
      const reply = await response.json()
      const marketsPage = asCoingeckoMarkets(reply)
      markets = [...markets, ...marketsPage]
    }
    const data: CoinrankRedis = { lastUpdate, markets }
    await setAsync(
      `${REDIS_COINRANK_KEY_PREFIX}_${defaultFiatCode}`,
      JSON.stringify(data)
    )
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
