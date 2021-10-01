import redis from 'redis'
import { promisify } from 'util'

import { coincapAssets } from './providers/coincap'
import { coinMarketCapAssets } from './providers/coinMarketCap'
import { nomicsAssets } from './providers/nomics'
import currencyCodeMaps from './utils/currencyCodeMaps.json'
import { createAssetMaps } from './utils/utils'

const client = redis.createClient()

export const getAsync = promisify(client.get).bind(client)
export const setAsync = promisify(client.set).bind(client)
export const hsetAsync = promisify(client.hset).bind(client)
export const hgetallAsync = promisify(client.hgetall).bind(client)
export const hmgetAsync = promisify(client.hmget).bind(client)
export const hmsetAsync = promisify(client.hmset).bind(client)
export const existsAsync = promisify(client.exists).bind(client)

const providerAssets = {
  coincap: coincapAssets,
  coinMarketCap: coinMarketCapAssets,
  nomics: nomicsAssets
}

export const uidEngine = async (): Promise<void> => {
  client.on('error', function(error) {
    console.error(error)
  })
  const currentDate = new Date().toISOString()

  try {
    const currencyCodeMapsHmsets = Object.keys(currencyCodeMaps).map(
      async key => {
        if (Array.isArray(currencyCodeMaps[key])) {
          return hmsetAsync(key, Object.assign({}, currencyCodeMaps[key]))
        }
        return key in providerAssets
          ? hmsetAsync(
              key,
              await createAssetMaps(currencyCodeMaps[key], providerAssets[key])
            )
          : hmsetAsync(key, currencyCodeMaps[key])
      }
    )
    await Promise.all(currencyCodeMapsHmsets)
  } catch (e) {
    console.log(currentDate)
    console.log(e)
  }
}
