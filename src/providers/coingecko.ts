import { asArray, asNumber, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { AssetMap, NewRates, ReturnRate } from '../rates'
import {
  assetMapReducer,
  createReducedRateMap,
  dateOnly,
  fromCode,
  fromCryptoToFiatCurrencyPair,
  hasUniqueId,
  invertCodeMapKey,
  isIsoCode,
  logger,
  snooze,
  withinLastFiveMinutes
} from './../utils/utils'

const {
  providers: {
    coingeckopro: { apiKey, uri }
  }
} = config

const asCoingeckoQuote = asObject({
  usd: asNumber
})

const asCoingeckoHistoricalUsdResponse = asObject({
  // eslint-disable-next-line @typescript-eslint/camelcase
  market_data: asObject({
    // eslint-disable-next-line @typescript-eslint/camelcase
    current_price: asObject({
      usd: asNumber
    })
  })
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

const coingeckoCurrent = async (
  currentTime: string,
  codesWanted: string[],
  assetMap: AssetMap
): Promise<NewRates> => {
  const rates: NewRates = { [currentTime]: {} }
  if (codesWanted.length === 0) return rates

  // Query
  try {
    const response = await fetch(
      `${uri}/api/v3/simple/price?x_cg_pro_api_key=${apiKey}&ids=${codesWanted.join(
        ','
      )}&vs_currencies=usd`
    )
    if (!response.ok) {
      logger(
        `coingecko returned code ${response.status} for ${codesWanted} at ${currentTime}`
      )
      throw new Error(response.statusText)
    }
    const json = asGeckoBulkUsdResponse(await response.json())

    // Create return object
    rates[currentTime] = coingeckoRateMap(json, assetMap)
  } catch (e) {
    logger('No Coingecko quote:', e)
  }
  return rates
}

const toCoinGeckoDate = (date: string): string => {
  const [year, month, day] = dateOnly(date).split('-')
  return `${day}-${month}-${year}`
}

const coingeckoHistorical = async (
  date: string,
  codesWanted: string[],
  assetMap: AssetMap
): Promise<NewRates> => {
  const rates: NewRates = { [date]: {} }
  if (codesWanted.length === 0) return rates

  // Query
  const queries = codesWanted.map(async code => {
    try {
      const response = await fetch(
        `${uri}/api/v3/coins/${code}/history?x_cg_pro_api_key=${apiKey}&date=${toCoinGeckoDate(
          date
        )}`
      )
      if (!response.ok) {
        logger(
          `coingecko returned code ${response.status} for ${codesWanted} at ${date}`
        )
        throw new Error(response.statusText)
      }
      const json = asCoingeckoHistoricalUsdResponse(await response.json())

      // Create return object
      const pair = Object.entries(assetMap).find(pair => pair[1] === code)
      if (pair == null) return

      rates[date][
        `${pair[0]}_iso:USD`
      ] = json.market_data.current_price.usd.toString()
    } catch (e) {
      logger('No Coingecko quote:', e)
    }
  })

  await Promise.all(queries)

  return rates
}

export const coingecko = async (
  requestedRates: ReturnRate[],
  currentTime: string,
  edgeAssetMap: AssetMap
): Promise<NewRates> => {
  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of requestedRates) {
    const fromCurrency = fromCode(pair.currency_pair)
    if (!isIsoCode(fromCurrency) && hasUniqueId(fromCurrency, edgeAssetMap)) {
      if (datesAndCodesWanted[pair.date] == null) {
        datesAndCodesWanted[pair.date] = []
      }
      datesAndCodesWanted[pair.date].push(edgeAssetMap[fromCurrency])
    }
  }

  const rates: NewRates = {}

  for (const date of Object.keys(datesAndCodesWanted)) {
    if (withinLastFiveMinutes(date)) {
      const currentRates = await coingeckoCurrent(
        date,
        datesAndCodesWanted[date],
        edgeAssetMap
      )
      rates[date] = currentRates[date]
    } else {
      const historicalRates = await coingeckoHistorical(
        date,
        datesAndCodesWanted[date],
        edgeAssetMap
      )
      rates[date] = historicalRates[date]
    }
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
