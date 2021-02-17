import { logger } from '../utils'

export const saveDocuments = (dbRates, log = logger) => (req, res, next) => {
  const { documents } = req
  Object.keys(documents).forEach(_id => {
    dbRates
      .insert({ _id, ...document[_id] })
      .then(() => {
        log('Saved new document', document)
      })
      .catch(e => {
        log('/exchangeRates error', e)
      })
  })

  return next()
}
