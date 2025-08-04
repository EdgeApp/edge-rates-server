import { asArray, asObject, asString } from 'cleaners'
import * as fs from 'fs'
import * as path from 'path'

import { config } from '../../../config'
import { snooze } from '../../../utils/utils'
import {
  EdgeCurrencyPluginId,
  RateEngine,
  RateProvider,
  TokenMap
} from '../../types'
import { createTokenId } from '../../utils'
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

// Mappings will eventually be saved in some database. They can be on disk for now.
const saveToDisk = (out: TokenMap): void => {
  const outputPath = path.join(__dirname, 'tokenMapping.json')
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2))
  console.log(`Token mapping saved to: ${outputPath}`)
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

export const coingecko: RateProvider = {
  providerId: 'coingecko',
  type: 'api',
  engines: [
    {
      frequency: 'day',
      engine: tokenMapping
    }
  ]
}
