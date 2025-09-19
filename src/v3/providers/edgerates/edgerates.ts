import { asArray, asObject, asString } from 'cleaners'
import { asCouchDoc } from 'edge-server-tools'

import { config } from '../../../config'
import { logger } from '../../../utils/utils'
import { LEADERBOARD_KEY } from '../../constants'
import {
  asEdgeAsset,
  type EdgeAsset,
  type GetRatesParams,
  type RateProvider
} from '../../types'
import { fromCryptoKey } from '../../utils'
import { dbSettings } from '../couch'
import { client } from '../redis'
import {
  defaultCrossChainMapping,
  defaultCrypto,
  defaultFiat,
  defaultPlatformPriority,
  defaultTokenTypes
} from './defaults'

const asEdgeRates = asObject({
  crypto: asArray(asEdgeAsset),
  fiat: asArray(asString)
})

const getTopCryptoAssets = async (): Promise<EdgeAsset[]> => {
  const limit = 100
  try {
    // zrevrange isn't exposed by library
    const luaScript = `
      local leaderboard = redis.call('ZREVRANGE', KEYS[1], 0, ${
        limit - 1
      }, 'WITHSCORES')
      return leaderboard
    `
    const result = (await client.eval(luaScript, {
      keys: [LEADERBOARD_KEY]
    })) as string[]

    const out: EdgeAsset[] = []
    // Process pairs of [member, score, member, score, ...]
    for (let i = 0; i < result.length; i += 2) {
      if (i / 2 >= limit) break
      out.push(fromCryptoKey(result[i]))
    }
    await client.del(LEADERBOARD_KEY)

    return out
  } catch (error) {
    console.error('Error finalizing leaderboard:', error)
    throw error
  }
}

const getCurrencyList = async (): Promise<{
  crypto: EdgeAsset[]
  fiat: string[]
}> => {
  try {
    const topCryptoAssets = await getTopCryptoAssets()
    return { crypto: topCryptoAssets, fiat: defaultFiat }
  } catch (e) {
    logger('Error grabbing leaderboard:', e)
  }
  try {
    const edgeDoc = await dbSettings.get('edgerates')
    const { crypto } = asCouchDoc(asEdgeRates)(edgeDoc).doc
    return { crypto, fiat: defaultFiat }
  } catch (e) {
    logger('Error grabbing couch settings:', e)
  }

  return { crypto: defaultCrypto, fiat: defaultFiat }
}

const fetchRates = async (): Promise<void> => {
  const { crypto, fiat } = await getCurrencyList()

  const isoDate = new Date()
  const requests: GetRatesParams[] = []
  while (crypto.length > 0 || fiat.length > 0) {
    const cryptoChunk = crypto.splice(0, 100)
    const fiatChunk = fiat.splice(0, 100)
    requests.push({
      targetFiat: 'USD',
      crypto: cryptoChunk.map(c => ({
        isoDate,
        asset: c,
        rate: undefined
      })),
      fiat: fiatChunk.map(f => ({
        isoDate,
        fiatCode: f,
        rate: undefined
      }))
    })
  }

  requests.forEach(request => {
    fetch(`http://${config.httpHost}:${config.httpPort}/v3/rates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    }).catch(logger)
  })
}

export const edgerates: RateProvider = {
  providerId: 'edgerates',
  type: 'api',
  documents: [
    {
      name: 'rates_settings',
      templates: {
        edgerates: {
          crypto: defaultCrypto,
          fiat: defaultFiat
        },
        tokenTypes: defaultTokenTypes,
        platformPriority: defaultPlatformPriority,
        'crosschain:automated': {},
        crosschain: defaultCrossChainMapping
      }
    }
  ],
  engines: [
    {
      engine: fetchRates,
      frequency: 'minute'
    }
  ]
}
