// import { serverError } from '../router/commons'
// import { Middleware, RateGetter, RateGetterOptions } from '../types/types'
// import { processorParallel } from '../utils/processor'
// import { curry } from '../utils/utils'

// export const getRate = async (
//   rateParams: RateGetterParams,
//   rateGetters: RateGetterCurried[],
//   rateData: ReturnGetRate = {}
// ): Promise<ReturnGetRate> => {
//   // If we already found the rate, return the rateData.
//   if (rateData.rate != null) return rateData
//   // If there are no "rateGetters", return a rateError error.
//   if (rateGetters.length === 0)
//     return {
//       error: serverError(
//         rateParams,
//         'All lookups failed to find exchange rate for this query',
//         'not_found',
//         400
//       )
//     }

//   try {
//     const newRateData = await rateGetters[0](rateParams, rateData.document)

//     return getRate(rateParams, rateGetters.slice(0), newRateData)
//   } catch (e) {
//     // Convert the error to rateError in case it's not one already.
//     return {
//       error: e.errorCode != null ? e : serverError(rateParams, e.message)
//     }
//   }
// }

// export const getRates = async (
//   ratesQuery: RateGetterParams[],
//   rateGetters: RateGetterCurried[],
//   rateData: Partial<ReturnGetRates> = {}
// ): Promise<ReturnGetRates> => {
//   const returnedRates = ratesQuery.map(async rateParams => {
//     const rateResponse = await getRate(rateParams, rateGetters)
//     return { ...rateParams, ...rateResponse }
//   })

//   const allRates = await Promise.all(returnedRates)

//   return allRates.reduce(
//     (
//       { documents, results }: ReturnGetRates,
//       { rate, date, error, currency_pair, document }
//     ): ReturnGetRates => {
//       if (document != null) {
//         const { _id } = document
//         documents[_id] =
//           documents[_id] == null ? document : { ...documents[_id], ...document }
//       }

//       if (error != null) {
//         results.push({ currency_pair, date, error })
//       } else {
//         results.push({ currency_pair, date, exchangeRate: rate })
//       }
//       return { documents, results }
//     },
//     { documents: {}, results: [] }
//   )
// }

// export const ratesMiddleware = (
//   opts: RateGetterOptions,
//   getters: RateGetter[] = defaultGetters
// ): Middleware => {
//   return async function(req, res, next): Promise<void> {
//     if (Array.isArray(req.params)) {
//       // const { documents, results } = await processorParallel(
//       //   ,
//       //   rateGetters,
//       //   {
//       //     results: res.results,
//       //     documents: req.documents
//       //   }
//       // )
//     } else {
//     }
//     res.documents = documents
//     res.results = results
//     return next()
//   }
// }
