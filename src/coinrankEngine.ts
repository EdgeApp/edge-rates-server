import fetch from 'node-fetch'

import { config } from './config'
import { REDIS_COINRANK_KEY_PREFIX } from './constants'
import {
  asCoingeckoMarkets,
  type CoinrankMarkets,
  type CoinrankRedis
} from './types'
import { setAsync, slackMessage } from './utils/dbUtils'
import { getDelay, logger, snooze } from './utils/utils'

const PAGE_SIZE = 250
const DEFAULT_WAIT_MS = 5 * 1000
const MAX_WAIT_MS = 5 * 60 * 1000
const NUM_PAGES = 8

const { defaultFiatCode } = config

export const coinrankEngine = async (
  runOnce: boolean = false
): Promise<void> => {
  while (true) {
    try {
      const { coinrankOffsetSeconds, coinrankIntervalSeconds } = config
      const delay = runOnce
        ? 0
        : getDelay({
            now: new Date(),
            intervalSeconds: coinrankIntervalSeconds,
            offsetSeconds: coinrankOffsetSeconds
          })

      logger(`**** COINRANK ENGINE SNOOZING ${delay / 1000}s`)
      await snooze(delay)

      logger('Updating Coinrank Cache')
      let wait = DEFAULT_WAIT_MS

      const lastUpdate = new Date().toISOString()
      const { apiKey, uri } = config.providers.coingeckopro
      let markets: CoinrankMarkets = []
      let page = 1
      while (true) {
        const url = `${uri}/api/v3/coins/markets?x_cg_pro_api_key=${apiKey}&vs_currency=USD&page=${page}&per_page=${PAGE_SIZE}&price_change_percentage=1h,24h,7d,14d,30d,1y`
        const response = await fetch(url)
        if (!response.ok) {
          const text = await response.text()
          logger(text)
          if (response.status === 429) {
            // retry. 10 req/min so need to delay
            logger(`Coinrank Rate Limited Snoozing ${wait.toString()}ms`)
            wait = Math.min(wait * 2, MAX_WAIT_MS)
            await snooze(wait)
            continue
          }
          logger(`Coinrank returned code ${response.status}`)
          throw new Error(text)
        }
        logger(`coinrank queried page ${page}`)
        wait = DEFAULT_WAIT_MS

        const reply = await response.json()
        const marketsPage = asCoingeckoMarkets(reply)
        markets = [...markets, ...marketsPage]
        page++
        if (page > NUM_PAGES) break
      }
      const data: CoinrankRedis = { lastUpdate, markets }
      await setAsync(
        `${REDIS_COINRANK_KEY_PREFIX}_${defaultFiatCode}`,
        JSON.stringify(data)
      )
    } catch (e) {
      const err: any = e // Weird TS issue causing :any to get removed from above line

      const message = `coinrankEngine failure: ${err.message}`
      slackMessage(message).catch(e => {
        logger(e)
      })
      logger(message)
    }
    if (runOnce) break
  }
}
