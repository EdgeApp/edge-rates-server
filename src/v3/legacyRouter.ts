import type { HttpResponse } from 'serverlet'
import type { ExpressRequest } from 'serverlet/express'

import { asExchangeRatesReq, getRedisMarkets } from '../exchangeRateRouter'
import {
  asCoinrankAssetReq,
  asCoinrankReq,
  type CoinrankAssetReq,
  type CoinrankReq
} from '../types'
import { hgetallAsync } from '../utils/dbUtils'
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

export const sendCoinranksV2 = async (
  request: ExpressRequest
): Promise<HttpResponse> => {
  if (request.req.query == null) {
    return {
      status: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request query' })
    }
  }
  let query: CoinrankReq
  try {
    query = asCoinrankReq(request.req.query)
  } catch (e) {
    return {
      status: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: `Invalid request query ${String(e)}` })
    }
  }
  const { fiatCode, start, length } = query

  try {
    if (start < 1 || start > 2000) {
      return {
        status: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          error: `Invalid start param: ${start}. Must be between 1-2000`
        })
      }
    }
    if (length < 1 || length > 100) {
      return {
        status: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          error: `Invalid length param: ${length}. Must be between 1-100`
        })
      }
    }
    const redisResult = await getRedisMarkets(fiatCode)

    if (redisResult == null) {
      return {
        status: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          error: `Unable to get results for fiatCode ${fiatCode}`
        })
      }
    }

    const { markets } = redisResult
    const data = markets.slice(start - 1, start + length)

    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data })
    }
  } catch (e: unknown) {
    return {
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: `Internal server error ${String(e)}` })
    }
  }
}

export const sendCoinrankAssetV2 = async (
  request: ExpressRequest
): Promise<HttpResponse> => {
  if (request.req.query == null) {
    return {
      status: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request query' })
    }
  }

  let query: CoinrankAssetReq
  try {
    query = asCoinrankAssetReq(request.req.query)
  } catch (e) {
    return {
      status: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: `Invalid request query ${String(e)}` })
    }
  }
  const { fiatCode } = query
  const pathParts = request.path.split('/')
  const assetId = pathParts[pathParts.length - 1]
  if (assetId == null) {
    return {
      status: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request path' })
    }
  }
  try {
    const redisResult = await getRedisMarkets(fiatCode)

    if (redisResult == null) {
      return {
        status: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          error: `Unable to get results for fiatCode ${fiatCode}`
        })
      }
    }

    const { markets } = redisResult
    const market = markets.find(m => m.assetId === assetId)
    if (market == null) {
      return {
        status: 404,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: `assetId ${assetId} not found` })
      }
    }

    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: market })
    }
  } catch (e: unknown) {
    return {
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: `Internal server error ${String(e)}` })
    }
  }
}

export const sendCoinrankListV2 = async (
  request: ExpressRequest
): Promise<HttpResponse> => {
  try {
    const data = await hgetallAsync('coingeckoassets')
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data })
    }
  } catch (e: unknown) {
    return {
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: `Internal server error ${String(e)}` })
    }
  }
}
