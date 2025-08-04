import { asArray, asMaybe, asNumber, asObject, asString } from 'cleaners'
import * as fs from 'fs'
import * as path from 'path'

import { config } from '../../../config'
import { dateOnly, snooze } from '../../../utils/utils'
import {
  EdgeCurrencyPluginId,
  NumberMap,
  RateBuckets,
  RateEngine,
  RateProvider,
  TokenMap
} from '../../types'
import {
  createTokenId,
  expandReturnedCryptoRates,
  reduceRequestedCryptoRates
} from '../../utils'
import {
  coingeckoMainnetCurrencyMapping,
  coingeckoPlatformIdMapping
} from './defaultPluginIdMapping'

const fetchCoingecko = async (
  input: RequestInfo,
  init: RequestInit = {}
): Promise<unknown> => {
  const headers = {
    'x-cg-pro-api-key': config.providers.coingeckopro.apiKey
  }
  while (true) {
    const response = await fetch(input, { headers, ...init })

    if (response.status === 429) {
      await snooze(1000)
      continue // retry
    }

    if (!response.ok) {
      const message = await response.text()
      throw new Error(`coingecko failed to fetch: ${message}`)
    }

    const json = await response.json()
    return json
  }
}

const asCoingeckoAssetResponse = asArray(
  asObject({
    id: asString,
    symbol: asString,
    name: asString,
    platforms: asObject(asString)
  })
)

const asGeckoBulkUsdResponse = asObject(
  asObject({
    usd: asNumber
  })
)

const asCoingeckoHistoricalUsdResponse = asObject({
  market_data: asObject({
    current_price: asObject({
      usd: asNumber
    })
  })
})

// Mappings will eventually be saved in some database. They can be on disk for now.
const saveToDisk = (out: TokenMap): void => {
  const outputPath = path.join(__dirname, 'tokenMapping.json')
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2))
  console.log(`Token mapping saved to: ${outputPath}`)
}

const readFromDisk = (): TokenMap => {
  const outputPath = path.join(__dirname, 'tokenMapping.json')
  if (!fs.existsSync(outputPath)) {
    return {}
  }
  const json = fs.readFileSync(outputPath, 'utf8')
  return JSON.parse(json)
}

const tokenMapping: RateEngine = async () => {
  const out: { [key: string]: { id: string; slug: string } } = {}

  // Add the mainnet currency mapping
  for (const [key, value] of Object.entries(coingeckoMainnetCurrencyMapping)) {
    if (value === null) continue
    out[`${key}_null`] = {
      id: value,
      slug: key
    }
  }

  const json = await fetchCoingecko(
    `${config.providers.coingeckopro.uri}/api/v3/coins/list?include_platform=true`
  )

  const data = asCoingeckoAssetResponse(json)

  const invertPlatformMapping: { [key: string]: string } = {}
  for (const [key, value] of Object.entries(coingeckoPlatformIdMapping)) {
    if (value === null) continue
    invertPlatformMapping[value] = key
  }

  for (const asset of data) {
    const firstPlatform: [string, string] | undefined = Object.entries(
      asset.platforms
    )[0]
    if (firstPlatform == null) continue

    const [platform, contractAddress] = firstPlatform

    const pluginId = invertPlatformMapping[platform]
    if (pluginId == null) continue

    try {
      const tokenId = createTokenId(
        pluginId as EdgeCurrencyPluginId,
        asset.symbol,
        contractAddress
      )
      if (tokenId == null) continue

      out[`${pluginId}_${String(tokenId)}`] = {
        id: asset.id,
        slug: asset.name
      }
    } catch (e) {
      // skip assets that we cannot create token id for
    }
  }

  saveToDisk(out)
}

const getCurrentRates = async (ids: Set<string>): Promise<NumberMap> => {
  const json = await fetchCoingecko(
    `${config.providers.coingeckopro.uri}/api/v3/simple/price?ids=${Array.from(
      ids
    ).join(',')}&vs_currencies=usd`
  )
  const data = asGeckoBulkUsdResponse(json)
  const out: NumberMap = {}
  for (const [key, value] of Object.entries(data)) {
    out[key] = value.usd
  }
  return out
}

const toCoinGeckoDate = (date: string): string => {
  const [year, month, day] = dateOnly(date).split('-')
  return `${day}-${month}-${year}`
}

const getHistoricalRates = async (
  ids: Set<string>,
  date: string
): Promise<NumberMap> => {
  const coingeckoDate = toCoinGeckoDate(date)

  const out: NumberMap = {}
  const promises: Array<Promise<void>> = []
  ids.forEach(id => {
    promises.push(
      fetchCoingecko(
        `${config.providers.coingeckopro.uri}/api/v3/coins/${id}/history?date=${coingeckoDate}`
      ).then(json => {
        const data = asMaybe(asCoingeckoHistoricalUsdResponse)(json)
        if (data != null) {
          out[id] = data.market_data.current_price.usd
        }
      })
    )
  })
  await Promise.all(promises)

  return out
}

const FIVE_MINUTES = 5 * 60 * 1000

const isCurrent = (isoDate: Date, nowDate: Date): boolean => {
  const requestedDate = isoDate.getTime()
  const rightNow = nowDate.getTime()
  if (requestedDate > rightNow || requestedDate + FIVE_MINUTES < rightNow) {
    return false
  }
  return true
}

export const coingecko: RateProvider = {
  providerId: 'coingecko',
  type: 'api',
  getCryptoRates: async ({ targetFiat, requestedRates }) => {
    if (targetFiat !== 'USD' || config.providers.coingeckopro.apiKey === '') {
      return {
        foundRates: new Map(),
        requestedRates
      }
    }

    const coingeckoTokenIdMap = readFromDisk()

    const rateBuckets = reduceRequestedCryptoRates(
      requestedRates,
      FIVE_MINUTES,
      coingeckoTokenIdMap
    )

    const currentDate = new Date()
    const allResults: RateBuckets = new Map()
    const promises: Array<Promise<void>> = []
    rateBuckets.forEach((ids, date) => {
      if (isCurrent(new Date(date), currentDate)) {
        promises.push(
          getCurrentRates(ids).then(results => {
            allResults.set(date, results)
          })
        )
      } else {
        promises.push(
          getHistoricalRates(ids, date).then(results => {
            allResults.set(date, results)
          })
        )
      }
    })
    await Promise.all(promises)

    const out = expandReturnedCryptoRates(
      requestedRates,
      FIVE_MINUTES,
      allResults,
      coingeckoTokenIdMap
    )

    return {
      foundRates: out.foundRates,
      requestedRates: out.requestedRates
    }
  },
  engines: [
    {
      frequency: 'day',
      engine: tokenMapping
    }
  ]
}
