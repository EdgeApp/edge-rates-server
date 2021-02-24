import { Cleaner } from 'cleaners'
import { Document, IdentifiedDocument } from 'nano'

import {
  ErrorMiddleware,
  ErrorType,
  Middleware,
  ServerError
} from '../types/types'

export const serverError = <T>(
  params: T,
  message: string,
  errorType: ErrorType = 'server_error',
  errorCode: number = 500
): ServerError & T => ({ message, errorCode, errorType, ...params })

export const postToSlackMiddleware = (
  slacker: (text: string) => Promise<void>
): ErrorMiddleware => (err, _req, _res, next) => {
  if (err.errorCode === 500) slacker(err.message).catch(e => e)
  next(err)
}

export const cleanRequestMiddleware = <T>(cleaner: Cleaner<T>): Middleware => (
  req,
  _res,
  next
) => {
  const params = Array.isArray(req.body)
    ? req.body
    : { ...(req.query ?? {}), ...(req.body ?? {}) }

  try {
    req.params = cleaner(params)
    next()
  } catch (e) {
    next(serverError(params, e.message, 'bad_query', 400))
  }
}

export const saveDocumentsMiddleware = (
  save: (documents: { [id: string]: IdentifiedDocument }) => Promise<void>
): Middleware => (_req, res) => {
  save(res.documents).catch(e => e)
  res.json(res.results)
}

export const loadDocumentsMiddleware = (
  load: (documents: { [id: string]: IdentifiedDocument }) => Promise<Document>
): Middleware => async (req, _res, next) =>
  load(req.documents ?? {})
    .then(docs => {
      Object.assign(req, { documents: docs })
      next()
    })
    .catch(e => next(serverError(req.params, e.message, 'db_error')))

// export const proccessQueryMiddleware = <R>(
//   processor: Processor<R>
// ): Middleware => async (req, res, next) => {
//   try {
//     const { error, result, documents = {} } = await processor(
//       req.params,
//       req.documents ?? {}
//     )
//     if (error) res.documents = documents
//     res.results = results
//     // response.
//   } catch (e) {
//     next(e)
//   }
// }
