import { createClient } from 'redis'

import { coincapAssets } from './providers/coincap'
import { coingeckoAssets } from './providers/coingecko'
import { coinMarketCapAssets } from './providers/coinMarketCap'
import { nomicsAssets } from './providers/nomics'
import { createThrottledMessage } from './utils/createThrottledMessage'
import currencyCodeMaps from './utils/currencyCodeMaps.json'
import { wrappedGetFromDb, wrappedSaveToDb } from './utils/dbUtils'
import { slackPoster } from './utils/postToSlack'
import { logger } from './utils/utils'

const client = createClient()
client.connect().catch(e => logger('redis connect error: ', e))

export const hsetAsync = client.hSet.bind(client)
export const hgetallAsync = client.hGetAll.bind(client)
export const hmgetAsync = client.hmGet.bind(client)
export const existsAsync = client.exists.bind(client)
export const delAsync = client.del.bind(client)
// Set type to `any` to avoid the TS4023 error
export const setAsync: any = client.set.bind(client)

const slackMessage = createThrottledMessage(client, slackPoster)

const providerAssets = {
  coincap: coincapAssets,
  coinMarketCap: coinMarketCapAssets,
  coingecko: coingeckoAssets,
  nomics: nomicsAssets
}

export const uidEngine = async (): Promise<void> => {
  client.on('error', function(error) {
    logger('redis client error', error)
  })

  logger('Updating UID Cache')
  try {
    const edgeDoc = (await wrappedGetFromDb(['currencyCodeMaps']))[0]
    const promises = Object.keys(providerAssets).map(provider =>
      providerAssets[provider]()
        .then(newMap => {
          // Combine the new UID map with existing UID map
          const assetMap = { ...edgeDoc[provider], ...newMap }

          // Remove the UIDs for the currency codes we've hardcoded
          for (let i = 0; i < edgeDoc.allEdgeCurrencies.length; i++) {
            delete assetMap[edgeDoc.allEdgeCurrencies[i]]
          }

          // Combine our codes with the new ones
          edgeDoc[provider] = {
            ...assetMap,
            ...currencyCodeMaps[provider]
          }
        })
        .catch(e => logger(`Failed to update ${provider}`, e))
        .finally(logger(`${provider} provider updated`))
    )
    await Promise.allSettled(promises)
    wrappedSaveToDb([edgeDoc])
  } catch (e) {
    const message = `ratesEngine failure: ${e}`
    slackMessage(message).catch(e => logger(e))
    logger(message)
  }
}
