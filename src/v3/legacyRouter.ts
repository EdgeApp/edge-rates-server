import type { HttpResponse } from 'serverlet'
import type { ExpressRequest } from 'serverlet/express'

import { asExchangeRatesReq } from '../exchangeRateRouter'
import { ratesV3, v2CurrencyCodeMapSyncDoc } from './router'
import { asGetRatesParams } from './types'
import { convertV2, convertV3ToV2 } from './v2converter'

export const ratesV2 = async (
  request: ExpressRequest,
  singleRate?: boolean
): Promise<HttpResponse> => {
  try {
    const requestedRates = asExchangeRatesReq(request.req.body)
    const v3request = convertV2(
      requestedRates.data,
      v2CurrencyCodeMapSyncDoc.doc.data
    )

    const v3HttpRequest = {
      ...request,
      method: 'POST',
      path: '/v3/rates'
    }
    v3HttpRequest.req.body = v3request

    const v3response = await ratesV3(v3HttpRequest)

    const v3Body = asGetRatesParams(JSON.parse(v3response.body as string))
    const v2response = convertV3ToV2(
      requestedRates.data,
      v3Body,
      v2CurrencyCodeMapSyncDoc.doc.data
    )
    if (singleRate === true) {
      return {
        ...v3response,
        body: JSON.stringify(v2response[0])
      }
    } else {
      return {
        ...v3response,
        body: JSON.stringify({ data: v2response })
      }
    }
  } catch (e) {
    return {
      status: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: `Invalid request body ${String(e)}` })
    }
  }
}

export const rateV2 = async (
  request: ExpressRequest
): Promise<HttpResponse> => {
  try {
    const { currency_pair, date } = request.req.query
    const requestedRates = asExchangeRatesReq({
      data: [{ currency_pair, date }]
    })
    request.req.body = requestedRates
    return await ratesV2(request, true)
  } catch (e) {
    return {
      status: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: `Invalid request body ${String(e)}` })
    }
  }
}
