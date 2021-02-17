import { RateGetter, RateParams, ReturnGetRate, ReturnGetRates } from '../types'
import { logger, SlackPoster } from '../utils'
import { rateError } from './rateHelpers'

const postToSlack = SlackPoster()

const getRateRec = async (
  rateParams: RateParams,
  rateGetters: RateGetter[],
  rateData: ReturnGetRate = {}
): Promise<ReturnGetRate> => {
  // If there are no "rateGetters", return a rateError error.
  if (rateGetters.length === 0)
    return {
      error: rateError(
        rateParams,
        'All lookups failed to find exchange rate for this query',
        'not_found',
        400
      )
    }

  try {
    const newRateData = await rateGetters[0](
      rateParams,
      rateData.document ?? { _id: rateParams.date }
    )
    if (newRateData.rate != null) return rateData

    return getRateRec(rateParams, rateGetters.slice(0), newRateData)
  } catch (e) {
    // Notify slack about critical errors with the database (like db is down).
    if (e.errorType === 'db_error') {
      postToSlack(
        new Date().toISOString(),
        `RATES SERVER: exchangeRate query failed for ${rateParams.currencyPair} with error code ${e.errorCode}.  ${e.message}`
      ).catch(e)
    }
    // Convert the error to rateError in case it's not one already.
    return {
      error: e.errorCode != null ? e : rateError(rateParams, e.message)
    }
  }
}

export const getRates = async (
  ratesQuery: RateParams[],
  rateGetters: RateGetter[]
): Promise<ReturnGetRates> => {
  const returnedRates = ratesQuery.map(async rateParams => {
    const rateResponse = await getRateRec(rateParams, rateGetters)
    return { ...rateParams, ...rateResponse }
  })

  const allRates = await Promise.all(returnedRates)

  return allRates.reduce(
    (
      { documents, results }: ReturnGetRates,
      { rate, date, error, currencyPair, document }
    ): ReturnGetRates => {
      if (document != null) {
        const { _id } = document
        documents[_id] =
          documents[_id] == null ? document : { ...documents[_id], ...document }
      }

      if (error != null) {
        logger(error)
        results.push({ currencyPair, date, error })
      } else {
        results.push({ currencyPair, date, exchangeRate: rate })
      }
      return { documents, results }
    },
    { documents: {}, results: [] }
  )
}
