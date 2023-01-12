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
  logger,
  snooze
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

const DEFAULT_WAIT_MS = 30 * 1000
const MAX_WAIT_MS = 5 * 60 * 1000

export const coingeckoAssets = async (): Promise<AssetMap> => {
  let page = 1
  const perPage = 250
  let out: ReturnType<typeof asCoingeckoAssetResponse> = []
  let wait = DEFAULT_WAIT_MS
  while (true) {
    const response = await fetch(
      `${uri}/api/v3/coins/markets?vs_currency=usd&per_page=${perPage}&page=${page}&order=market_cap_asc`
    )
    if (!response.ok) {
      const text = await response.text()
      logger(text)
      if (response.status === 429) {
        // retry. 10 req/min so need to delay
        logger(`coingeckoAssets Rate Limited Snoozing ${wait.toString()}ms`)
        wait = Math.min(wait * 2, MAX_WAIT_MS)
        await snooze(wait)
        continue
      }

      logger(`coingeckoAssets returned code ${response.status}`)
      throw new Error(text)
    }
    wait = DEFAULT_WAIT_MS
    await snooze(wait)

    const json = asCoingeckoAssetResponse(await response.json()).map(uid => ({
      id: uid.id,
      symbol: uid.symbol.toUpperCase()
    }))

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
