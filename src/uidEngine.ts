// import { coincapAssets } from './providers/coincap'
import { coingeckoAssets } from './providers/coingecko'
import { coinMarketCapAssets } from './providers/coinMarketCap'
import currencyCodeMaps from './utils/currencyCodeMaps.json'
import {
  slackMessage,
  wrappedGetFromDb,
  wrappedSaveToDb
} from './utils/dbUtils'
import { logger, snooze } from './utils/utils'

const providerAssets = {
  // coincap: coincapAssets, // Disabled because ZEC rates are bad. Can re-enable once we can blacklist IDs.
  coinMarketCap: coinMarketCapAssets,
  coingecko: coingeckoAssets
}

const DEFAULT_WAIT_MS = 60 * 60 * 1000 // 1 hour

export const uidEngine = async (): Promise<void> => {
  while (true) {
    logger('Updating UID Cache')
    try {
      const edgeDoc = (await wrappedGetFromDb(['currencyCodeMaps']))[0]
      const promises = Object.keys(providerAssets).map(provider =>
        providerAssets[provider]()
          .then(newMap => {
            // Combine the new UID map with existing UID map
            const assetMap = { ...edgeDoc[provider], ...newMap }

            // Remove the UIDs for the currency codes we've hardcoded
            for (const currencyCode of edgeDoc.allEdgeCurrencies) {
              delete assetMap[currencyCode]
            }

            // Combine our codes with the new ones
            edgeDoc[provider] = {
              ...assetMap,
              ...currencyCodeMaps[provider]
            }
          })
          .catch(e => {
            logger(`Failed to update ${provider}`, e)
          })
          .finally(() => {
            logger(`${provider} provider updated`)
          })
      )
      await Promise.allSettled(promises)
      wrappedSaveToDb([edgeDoc])
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const message = `ratesEngine failure: ${e}`
      slackMessage(message).catch(e => {
        logger(e)
      })
      logger(message)
    }
    logger('UID Cache updated. Snoozing for 1 hour')
    await snooze(DEFAULT_WAIT_MS)
  }
}
