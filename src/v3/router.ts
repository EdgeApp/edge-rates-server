import { HttpResponse } from 'serverlet'
import { ExpressRequest } from 'serverlet/express'

import { ONE_MINUTE } from './constants'
import { getRates } from './getRates'
import {
  asIncomingGetRatesParams,
  GetRatesParams,
  IncomingGetRatesParams
} from './types'

const fixIncomingGetRatesParams = (
  rawParams: IncomingGetRatesParams
): GetRatesParams => {
  const rightNow = Date.now()
  const normalizeTime = Math.floor(rightNow / ONE_MINUTE) * ONE_MINUTE
  const normalizedIsoDate = new Date(normalizeTime)

  const params = asIncomingGetRatesParams(rawParams)

  params.crypto.forEach(crypto => {
    if (crypto.isoDate == null) {
      crypto.isoDate = normalizedIsoDate
    }
  })
  params.fiat.forEach(fiat => {
    if (fiat.isoDate == null) {
      fiat.isoDate = normalizedIsoDate
    }
  })

  return params as GetRatesParams
}

export const ratesV3 = async (
  request: ExpressRequest
): Promise<HttpResponse> => {
  try {
    const params = fixIncomingGetRatesParams(request.req.body)
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
