import { asArray, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { AssetMap, NewRates, ReturnRate } from '../rates'
import {
  assetMapReducer,
  checkConstantCode,
  createReducedRateMapArray,
  fromCode,
  fromCryptoToFiatCurrencyPair,
  isFiatCode,
  logger,
  subIso
} from './../utils/utils'

// TODO: add ID map

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

export const nomics = async (
  requestedRates: ReturnRate[],
  currentTime: string
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
    const fromCurrency = checkConstantCode(fromCode(request.currency_pair))
    if (!isFiatCode(fromCurrency)) {
      codesWanted.push(fromCurrency)
    }
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
      logger(`No Nomics quote: ${JSON.stringify(e)}`)
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
  const response = await fetch(
    `${uri}/v1/currencies/ticker?key=${apiKey}&sort=rank&status=active`
  )
  if (
    response.status === 429 ||
    response.status === 401 ||
    response.ok === false
  ) {
    logger(`nomicsAssets returned code ${response.status}`)
    throw new Error(response.statusText)
  }

  return assetMapReducer(asNomicsAssetResponse(await response.json()))
}
