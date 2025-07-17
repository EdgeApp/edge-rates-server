import { HttpResponse } from 'serverlet'
import { ExpressRequest } from 'serverlet/express'

import { getRates } from './getRates'
import { asGetRatesParams } from './types'

export const ratesV3 = async (
  request: ExpressRequest
): Promise<HttpResponse> => {
  try {
    const params = asGetRatesParams(request.req.body)
    const result = await getRates(params)
    return {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(result)
    }
  } catch (e) {
    return {
      status: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: `Invalid request body ${String(e)}` })
    }
  }
}
