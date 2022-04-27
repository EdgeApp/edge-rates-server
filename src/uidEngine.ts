import { createClient } from 'redis'

import { coincapAssets } from './providers/coincap'
import { coinMarketCapAssets } from './providers/coinMarketCap'
import { nomicsAssets } from './providers/nomics'
import currencyCodeMaps from './utils/currencyCodeMaps.json'
import { createAssetMaps, logger } from './utils/utils'

const client = createClient()
client.connect().catch(e => console.log('redis connect error: ', e))

export const hsetAsync = client.hSet.bind(client)
export const hgetallAsync = client.hGetAll.bind(client)
export const existsAsync = client.exists.bind(client)

const providerAssets = {
  coincap: coincapAssets,
  coinMarketCap: coinMarketCapAssets,
  nomics: nomicsAssets
}

export const uidEngine = (): void => {
  client.on('error', function(error) {
    console.error(error)
  })
  const currentDate = new Date().toISOString()

  try {
    for (const key of Object.keys(currencyCodeMaps)) {
      if (Array.isArray(currencyCodeMaps[key])) {
        hsetAsync(key, Object.assign({}, currencyCodeMaps[key])).catch(e =>
          logger('uidEngine', key, e)
        )
        continue
      }
      if (key in providerAssets) {
        createAssetMaps(currencyCodeMaps[key], providerAssets[key])
          .then(res => {
            hsetAsync(key, res).catch(e => logger('uidEngine', key, e))
          })
          .catch(e => logger('uidEngine', key, e))
      } else {
        hsetAsync(key, currencyCodeMaps[key]).catch(e =>
          logger('uidEngine', key, e)
        )
      }
    }
  } catch (e) {
    console.log(currentDate)
    console.log(e)
  }
}
