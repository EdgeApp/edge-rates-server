import { asArray, asNumber, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { AssetMap, NewRates, ReturnRate } from '../rates'
import {
  assetMapReducer,
  createReducedRateMap,
  fromCode,
  fromCryptoToFiatCurrencyPair,
  hasUniqueId,
  invertCodeMapKey,
  isIsoCode,
  logger
} from './../utils/utils'

const {
  providers: {
    coingecko: { uri }
  }
} = config

const asCoingeckoQuote = asObject({
  usd: asNumber
})

const asGeckoBulkUsdResponse = asObject(asCoingeckoQuote)

const coingeckoQuote = (
  data: ReturnType<typeof asGeckoBulkUsdResponse>,
  code: string
): string => data[code].usd.toString()

const coingeckoRateMap = createReducedRateMap(
  fromCryptoToFiatCurrencyPair,
  coingeckoQuote,
  invertCodeMapKey
)

export const coingecko = async (
  requestedRates: ReturnRate[],
  currentTime: string,
  edgeAssetMap: AssetMap
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  // Gather codes
  const codesWanted: string[] = []
  for (const request of requestedRates) {
    if (request.date !== currentTime) continue
    const fromCurrency = fromCode(request.currency_pair)
    if (!isIsoCode(fromCurrency) && hasUniqueId(fromCurrency, edgeAssetMap))
      codesWanted.push(edgeAssetMap[fromCurrency])
  }

  // Query
  if (codesWanted.length === 0) return rates
  try {
    const response = await fetch(
      `${uri}/api/v3/simple/price?ids=${codesWanted.join(
        ','
      )}&vs_currencies=usd`
    )
    if (
      response.status === 429 ||
      response.status === 401 ||
      response.ok === false
    ) {
      logger(
        `coingecko returned code ${response.status} for ${codesWanted} at ${currentTime}`
      )
      throw new Error(response.statusText)
    }
    const json = asGeckoBulkUsdResponse(await response.json())

    // Create return object
    rates[currentTime] = coingeckoRateMap(json, edgeAssetMap)
  } catch (e) {
    logger('No Coingecko quote:', e)
  }
  return rates
}

const asCoingeckoAssetResponse = asArray(
  asObject({
    id: asString,
    symbol: asString
  })
)

export const coingeckoAssets = async (): Promise<AssetMap> => {
  let page = 1
  const perPage = 250
  let out: ReturnType<typeof asCoingeckoAssetResponse> = []
  while (true) {
    const response = await fetch(
      `${uri}/api/v3/coins/markets?vs_currency=usd&per_page=${perPage}&page=${page}&order=market_cap_asc`
    )
    if (response.status === 429) continue // retry. 1 req/sec so no need to delay
    if (response.status === 401 || response.ok === false) {
      logger(`coingeckoAssets returned code ${response.status}`)
      throw new Error(response.statusText)
    }
    const json = asCoingeckoAssetResponse(await response.json())
    out = [...out, ...json]
    if (Object.keys(json).length < perPage) break
    // It's a long process so we should log the progress
    logger(
      `Querying coingeckoAssets page ${page}. Found ${out.length} assets so far`
    )
    page++
  }
  logger(`Finished coingeckoAssets query found ${out.length} assets`)
  return assetMapReducer(out)
}
