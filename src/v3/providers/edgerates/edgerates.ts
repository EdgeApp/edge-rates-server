import { asArray, asObject, asString } from 'cleaners'
import { asCouchDoc } from 'edge-server-tools'

import { config } from '../../../config'
import { logger } from '../../../utils/utils'
import {
  asEdgeAsset,
  EdgeAsset,
  GetRatesParams,
  RateProvider
} from '../../types'
import { dbSettings } from '../couch'
import { defaultCrypto, defaultFiat } from './defaults'

const asEdgeRates = asObject({
  crypto: asArray(asEdgeAsset),
  fiat: asArray(asString)
})

const getCurrencyList = async (): Promise<{
  crypto: EdgeAsset[]
  fiat: string[]
}> => {
  try {
    const edgeDoc = await dbSettings.get('edgerates')
    const { crypto, fiat } = asCouchDoc(asEdgeRates)(edgeDoc).doc
    return { crypto, fiat }
  } catch (e) {
    logger(e)
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
        }
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
