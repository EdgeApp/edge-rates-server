import { HttpResponse } from 'serverlet'
import { ExpressRequest } from 'serverlet/express'

export const ratesV3 = (request: ExpressRequest): HttpResponse => {
  return {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }
}
