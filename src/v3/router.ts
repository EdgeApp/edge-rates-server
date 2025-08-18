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
  rawParams: IncomingGetRatesParams,
  rightNow: Date
): GetRatesParams => {
  const normalizeTime = Math.floor(rightNow.getTime() / ONE_MINUTE) * ONE_MINUTE
  const normalizedIsoDate = new Date(normalizeTime)

  const params = asIncomingGetRatesParams(rawParams)

  if (params.targetFiat !== 'USD') {
    throw new Error('targetFiat must be USD')
  }

  params.crypto.forEach(crypto => {
    // Sanity check that the tokenId doesn't include _
    if (
      typeof crypto.asset.tokenId === 'string' &&
      crypto.asset.tokenId.includes('_')
    ) {
      throw new Error('tokenId cannot include _')
    }
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
    const rightNow = new Date()
    const params = fixIncomingGetRatesParams(request.req.body, rightNow)
    const result = await getRates(params, rightNow)
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
