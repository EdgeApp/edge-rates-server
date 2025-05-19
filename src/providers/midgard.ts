import { asObject, asString } from 'cleaners'
import fetch from 'node-fetch'

import { config } from '../config'
import { NewRates, RateMap, ReturnRate } from '../rates'
import { logger } from '../utils/utils'

const { uri } = config.providers.midgard
// https://midgard.ninerealms.com/v2/pool/THOR.TCY
const asMidgardTcyResponse = asObject({
  // annualPercentageRate: '10.261585964326816',
  // asset: 'THOR.TCY',
  // assetDepth: '223863906811412',
  // assetPrice: '0.18381873155332273',
  assetPriceUSD: asString
  // earnings: '4004966054359',
  // earningsAnnualAsPercentOfDepth: '2.537405194396682',
  // liquidityUnits: '30164031604896',
  // lpLuvi: 'NaN',
  // nativeDecimal: '8',
  // poolAPY: '10.261585964326816',
  // runeDepth: '41150379390645',
  // saversAPR: '0',
  // saversDepth: '0',
  // saversUnits: '0',
  // status: 'available',
  // synthSupply: '0',
  // synthUnits: '0',
  // totalCollateral: '0',
  // totalDebtTor: '0',
  // units: '30164031604896',
  // volume24h: '128829051343702'
})

const midgardRateMap = (
  results: ReturnType<typeof asMidgardTcyResponse>
): RateMap => ({ 'TCY_iso:USD': results.assetPriceUSD })

const midgard = async (
  requestedRates: ReturnRate[],
  currentTime: string
): Promise<NewRates> => {
  const rates = { [currentTime]: {} }

  // This is a TCY-only provider so we can check to exit early
  if (requestedRates.find(req => req.currency_pair === 'TCY_iso:USD') == null)
    return rates

  // Query
  try {
    const response = await fetch(`${uri}/v2/pool/THOR.TCY`)
    if (response.status !== 200) {
      throw new Error(response.statusText)
    }
    const json = asMidgardTcyResponse(await response.json())
    rates[currentTime] = midgardRateMap(json)
  } catch (e) {
    logger(`No midgard TCY pool quote`, e)
  }

  return rates
}

export { midgard }
