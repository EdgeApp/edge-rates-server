import { asArray, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { AssetMap, NewRates, ReturnRate } from '../rates'
import {
  assetMapReducer,
  createReducedRateMapArray,
  fromCode,
  fromCryptoToFiatCurrencyPair,
  isIsoCode,
  logger,
  subIso
} from './../utils/utils'

const {
  providers: {
    nomics: { uri, apiKey }
  },
  defaultFiatCode: DEFAULT_FIAT
} = config

const asNomicsQuote = asObject({
  price: asString,
  symbol: asString
})

const asNomicsResponse = asArray(asNomicsQuote)

const nomicsQuote = (code: ReturnType<typeof asNomicsQuote>): string =>
  code.price

const nomicsPair = (code: ReturnType<typeof asNomicsQuote>): string =>
  fromCryptoToFiatCurrencyPair(code.symbol)

const nomicsRateMap = createReducedRateMapArray(nomicsPair, nomicsQuote)

const overrideCode = (code: string, assetMap: AssetMap): string =>
  assetMap[code] ?? code

export const nomics = async (
  requestedRates: ReturnRate[],
  currentTime: string,
  edgeAssetMap: AssetMap
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  if (apiKey == null) {
    logger('No Nomics API key')
    return rates
  }

  // Gather codes
  const codesWanted: string[] = []
  for (const request of requestedRates) {
    if (request.date !== currentTime) continue
    const fromCurrency = fromCode(request.currency_pair)
    if (!isIsoCode(fromCurrency))
      codesWanted.push(overrideCode(fromCurrency, edgeAssetMap))
  }

  // Query
  if (codesWanted.length > 0)
    try {
      const ids = codesWanted.join(',')
      const response = await fetch(
        `${uri}/v1/currencies/ticker?key=${apiKey}&ids=${ids}&convert=${subIso(
          DEFAULT_FIAT
        )}`
      )
      if (
        response.status === 429 ||
        response.status === 401 ||
        response.ok === false
      ) {
        logger(
          `nomics returned code ${response.status} for ${ids} at ${currentTime}`
        )
        throw new Error(response.statusText)
      }
      const json = asNomicsResponse(await response.json())

      // Create return object
      rates[currentTime] = nomicsRateMap(json)
    } catch (e) {
      logger('No Nomics quote:', e)
    }
  return rates
}

const asNomicsAssetResponse = asArray(
  asObject({
    id: asString,
    symbol: asString
  })
)

export const nomicsAssets = async (): Promise<AssetMap> => {
  let page = 1
  let out: ReturnType<typeof asNomicsAssetResponse> = []
  while (true) {
    const response = await fetch(
      `${uri}/v1/currencies/ticker?key=${apiKey}&sort=rank&status=active&page=${page}`
    )
    if (response.status === 429) continue // retry. 1 req/sec so no need to delay
    if (response.status === 401 || response.ok === false) {
      logger(`nomicsAssets returned code ${response.status}`)
      throw new Error(response.statusText)
    }
    const json = asNomicsAssetResponse(await response.json())
    out = [...out, ...json]
    if (Object.keys(json).length < 100) break
    // It's a long process so we should log the progress
    console.log(
      `Querying nomicsAssets page ${page}. Found ${out.length} assets so far`
    )
    page++
  }
  console.log(`Finished nomicsAssets query found ${out.length} assets`)
  return assetMapReducer(out)
}
