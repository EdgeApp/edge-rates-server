import { asArray, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { NewRates, ReturnRate } from '../rates'
import {
  AssetMap,
  coincapDefaultMap,
  coincapEdgeMap,
  fiatCurrencyCodes
} from '../utils/currencyCodeMaps'
import { checkConstantCode, logger } from './../utils/utils'

const ONE_MINUTE = 1000 * 60
const OPTIONS = {
  method: 'GET',
  json: true
}

const createUniqueIdString = (
  requestedCodes: string[],
  codeMap: AssetMap
): string => {
  return requestedCodes
    .filter(code => codeMap[code] != null)
    .map(code => codeMap[code])
    .join(',')
}

const asCoincapCurrentResponse = asObject({
  data: asArray(asObject({ symbol: asString, priceUsd: asString }))
})

const asCoincapHistoricalResponse = asObject({
  data: asArray(asObject({ priceUsd: asString }))
})

const coincap = async (
  rateObj: ReturnRate[],
  currentTime: string,
  assetMaps: { [provider: string]: AssetMap }
): Promise<NewRates> => {
  const rates = {}
  const assetMap = {
    ...coincapDefaultMap,
    ...coincapEdgeMap,
    ...assetMaps.coincapAssets
  }

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    const fromCurrency = checkConstantCode(pair.currency_pair.split('_')[0])
    if (fiatCurrencyCodes[fromCurrency] == null) {
      if (datesAndCodesWanted[pair.date] == null) {
        datesAndCodesWanted[pair.date] = []
      }
      datesAndCodesWanted[pair.date].push(fromCurrency)
    }

    // Query
    for (const date in datesAndCodesWanted) {
      if (datesAndCodesWanted[date].length === 0) continue
      rates[date] = {}

      if (date === currentTime) {
        // Latest data endpoint accepts bulk requests
        const codes = createUniqueIdString(datesAndCodesWanted[date], assetMap)
        if (codes === '') continue
        const url = `https://api.coincap.io/v2/assets?ids=${codes}`
        try {
          const response = await fetch(url, OPTIONS)
          const json = asCoincapCurrentResponse(await response.json())
          if (response.ok === false) {
            logger(
              `coincapCurrent returned code ${response.status} for ${codes} at ${currentTime}`
            )
            throw new Error(response.status)
          }

          // Add to return object
          json.data.forEach(obj => {
            rates[date][`${obj.symbol}_USD`] = obj.priceUsd
          })
        } catch (e) {
          logger(`No coincapCurrent quote: ${JSON.stringify(e)}`)
        }
      } else {
        // Historical data endpoint is limited to one currency at a time
        for (const code of datesAndCodesWanted[date]) {
          const timestamp = Date.parse(date)
          const id = createUniqueIdString([code], assetMap)
          if (id === '') continue
          try {
            const response = await fetch(
              `https://api.coincap.io/v2/assets/${id}/history?interval=m1&start=${timestamp}&end=${timestamp +
                ONE_MINUTE}`,
              OPTIONS
            )
            const json = asCoincapHistoricalResponse(await response.json())
            if (response.ok === false) {
              logger(
                `coincapHistorical returned code ${response.status} for ${id} at ${date}`
              )
              throw new Error(response.status)
            }

            // Add to return object
            if (json.data.length > 0) {
              rates[date][`${code}_USD`] = json.data[0].priceUsd
            }
          } catch (e) {
            logger(`No coincapHistorical quote: ${JSON.stringify(e)}`)
          }
        }
      }
    }
  }
  return rates
}

const asCoincapAssetResponse = asObject({
  data: asArray(asObject({ id: asString, symbol: asString }))
})

const coincapAssets = async (): Promise<AssetMap> => {
  const assets: { [code: string]: string } = {}
  const response = await fetch('https://api.coincap.io/v2/assets?limit=2000')
  if (response.ok === false) {
    throw new Error(response.status)
  }
  const json = asCoincapAssetResponse(await response.json()).data

  for (const obj of json) {
    if (assets[obj.symbol] == null) assets[obj.symbol] = obj.id
  }

  return assets
}

export { coincap, coincapAssets }
