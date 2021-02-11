import { bns } from 'biggystring'
import nano from 'nano'

import { RateParams } from '../types'
import { log } from '../utils'

export type DbFetch = (rateParam: RateParams, localDb: any) => Promise<string>

export const coinFromDb: DbFetch = async (
  { currencyA, currencyB, date },
  localDb
) => {
  let rate = ''
  try {
    const exchangeRate: nano.DocumentGetResponse & {
      [pair: string]: any
    } = await localDb.get(date)
    if (exchangeRate[`${currencyA}_${currencyB}`] != null) {
      rate = exchangeRate[`${currencyA}_${currencyB}`]
    } else if (exchangeRate[`${currencyB}_${currencyA}`] != null) {
      rate = bns.div('1', exchangeRate[`${currencyB}_${currencyA}`], 8, 10)
    }
  } catch (e) {
    if (e.error !== 'not_found') {
      log(
        `DB read error `,
        `currencyA: ${currencyA}`,
        `currencyB: ${currencyB}`,
        e
      )
      throw e
    }
  }
  return rate
}
