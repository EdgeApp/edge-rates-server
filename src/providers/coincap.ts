import { asArray, asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { NewRates, ReturnRate } from '../rates'
import { coincapDefaultMap, coincapEdgeMap } from '../utils/currencyCodeMaps'
import { checkConstantCode, isFiatCode, logger } from './../utils/utils'

const ONE_MINUTE = 1000 * 60
const OPTIONS = {
  method: 'GET',
  json: true
}
const CODE_MAP = { ...coincapDefaultMap, ...coincapEdgeMap }

const createUniqueIdString = (requestedCodes: string[]): string => {
  return requestedCodes
    .filter(code => CODE_MAP[code] != null)
    .map(code => CODE_MAP[code])
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
  currentTime: string
): Promise<NewRates> => {
  const rates = {}

  // Gather codes
  const datesAndCodesWanted: { [key: string]: string[] } = {}
  for (const pair of rateObj) {
    const fromCurrency = checkConstantCode(pair.currency_pair.split('_')[0])
    if (!isFiatCode(fromCurrency)) {
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
        const codes = createUniqueIdString(datesAndCodesWanted[date])
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
            rates[date][`${obj.symbol}_iso:USD`] = obj.priceUsd
          })
        } catch (e) {
          logger(`No coincapCurrent quote: ${JSON.stringify(e)}`)
        }
      } else {
        // Historical data endpoint is limited to one currency at a time
        for (const code of datesAndCodesWanted[date]) {
          const timestamp = Date.parse(date)
          const id = createUniqueIdString([code])
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
              rates[date][`${code}_iso:USD`] = json.data[0].priceUsd
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

export { coincap }
