import { asObject, asOptional, asString } from 'cleaners'
import { MangoSelector } from 'nano'
import { HttpResponse } from 'serverlet'
import { ExpressRequest } from 'serverlet/express'

import { dbTokens } from './providers/couch'
import { asTokenInfoDoc, EdgeTokenInfo } from './types'
import { toCryptoKey } from './utils'

const asGetTokenQuery = asObject({
  tokenId: asString,
  pluginIds: asOptional(asString)
})

// ---------------------------
// Shared helpers
// ---------------------------

const parsePluginIds = (pluginIds?: string): string[] | undefined =>
  pluginIds?.split(',').filter(Boolean)

const chooseTokenIdIndex = (withPlugin: boolean): [string, string] =>
  withPlugin
    ? ['idxTokenIdPlugin', 'idx_tokenId_plugin']
    : ['idxTokenId', 'idx_tokenId']

const chooseTextIndex = (withPlugin: boolean): [string, string] =>
  withPlugin
    ? ['idxTokensTextPlugin', 'idx_tokens_text_plugin']
    : ['idxTokensText', 'idx_tokens_text']

const chooseRankIndex = (withPlugin: boolean): [string, string] =>
  withPlugin ? ['idxRankPlugin', 'idx_rank_plugin'] : ['idxRank', 'idx_rank']

const getTokenDocs = async (params: {
  selector: MangoSelector
  useIndex?: [string, string]
  limit?: number
  skip?: number
}): Promise<EdgeTokenInfo[]> => {
  const { selector, useIndex, limit, skip } = params
  const response = await dbTokens.find({
    selector,
    use_index: useIndex,
    limit,
    skip,
    sort: [{ rank: 'asc' }]
  })
  return response.docs.map(doc => asTokenInfoDoc(doc).doc)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const buildMangoSelector = (options: {
  searchTerm?: string
  field?: 'currencyCode' | 'displayName' | 'tokenId'
  chainPluginIds?: string[]
}): MangoSelector => {
  const { searchTerm, field, chainPluginIds } = options

  const selector: MangoSelector = {}

  // Handle pluginId scope
  if (chainPluginIds != null && chainPluginIds.length > 0) {
    if (chainPluginIds.length === 1) {
      selector.chainPluginId = chainPluginIds[0]
    } else {
      selector.$or = chainPluginIds.map(pid => ({ chainPluginId: pid }))
    }
  }

  if (searchTerm == null) return selector

  // Handle the field search
  if (field === 'currencyCode') {
    selector.currencyCode = {
      $gte: searchTerm,
      $lt: searchTerm + '\uffff'
    }
  } else if (field === 'displayName') {
    selector.displayName = { $regex: `(?i).*${escapeRegex(searchTerm)}.*` }
  } else if (field === 'tokenId') {
    selector.tokenId = searchTerm
  }

  return selector
}

// ---------------------------
// Endpoints
// ---------------------------

export const getTokenV1 = async (
  request: ExpressRequest
): Promise<HttpResponse> => {
  try {
    const { tokenId, pluginIds } = asGetTokenQuery(request.req.query)
    const whitelistPluginIds = parsePluginIds(pluginIds)
    const usingPluginFilter =
      whitelistPluginIds != null && whitelistPluginIds.length > 0

    const mangoSelector = buildMangoSelector({
      searchTerm: tokenId,
      field: 'tokenId',
      chainPluginIds: whitelistPluginIds
    })

    const result = await getTokenDocs({
      selector: mangoSelector,
      useIndex: chooseTokenIdIndex(usingPluginFilter),
      limit: 100
    })

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

const asFindTokenQuery = asObject({
  searchTerm: asString,
  pluginIds: asOptional(asString)
})

export const findTokensV1 = async (
  request: ExpressRequest
): Promise<HttpResponse> => {
  try {
    const { searchTerm, pluginIds } = asFindTokenQuery(request.req.query)
    if (searchTerm.length === 0) {
      return {
        status: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          error: 'Search term must be at least 1 character'
        })
      }
    }

    const whitelistPluginIds = parsePluginIds(pluginIds)
    const usingPluginFilter =
      whitelistPluginIds != null && whitelistPluginIds.length > 0

    const textIndex = chooseTextIndex(usingPluginFilter)

    // Currency code lookup
    const currencyCodeSelector = buildMangoSelector({
      searchTerm,
      field: 'currencyCode',
      chainPluginIds: whitelistPluginIds
    })
    const currencyCodeMatches = await getTokenDocs({
      selector: currencyCodeSelector,
      useIndex: textIndex,
      limit: 100
    })

    // Display name lookup
    const displayNameSelector = buildMangoSelector({
      searchTerm,
      field: 'displayName',
      chainPluginIds: whitelistPluginIds
    })
    const displayNameMatches = await getTokenDocs({
      selector: displayNameSelector,
      useIndex: textIndex,
      limit: 100
    })

    // Token ID lookup
    const tokenIdIndex = chooseTokenIdIndex(usingPluginFilter)
    const tokenIdSelector = buildMangoSelector({
      searchTerm,
      field: 'tokenId',
      chainPluginIds: whitelistPluginIds
    })
    const tokenIdMatches = await getTokenDocs({
      selector: tokenIdSelector,
      useIndex: tokenIdIndex,
      limit: 100
    })

    // Filter out duplicates
    const uniqueResults: { [id: string]: EdgeTokenInfo } = {}
    for (const doc of [
      ...currencyCodeMatches,
      ...displayNameMatches,
      ...tokenIdMatches
    ]) {
      const key = toCryptoKey({
        pluginId: doc.chainPluginId,
        tokenId: doc.tokenId
      })
      if (uniqueResults[key] == null) uniqueResults[key] = doc
    }
    const sortedResults = Object.values(uniqueResults).sort(
      (a, b) => a.rank - b.rank
    )

    return {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sortedResults)
    }
  } catch (e) {
    return {
      status: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: `Invalid request body ${String(e)}` })
    }
  }
}

const asListTokensQuery = asObject({
  page: asOptional(asString, '0'),
  pageSize: asOptional(asString, '10'),
  pluginIds: asOptional(asString)
})

export const listTokensV1 = async (
  request: ExpressRequest
): Promise<HttpResponse> => {
  try {
    const {
      page: pageStr,
      pageSize: pageSizeStr,
      pluginIds
    } = asListTokensQuery(request.req.query)
    const page = parseInt(pageStr)
    const pageSize = parseInt(pageSizeStr)

    // Enforce constraints: page >= 0, 10 <= pageSize <= 100
    if (page < 0) {
      return {
        status: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          error: 'Page must be greater than or equal to 0'
        })
      }
    }
    if (pageSize > 100 || pageSize < 10) {
      return {
        status: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Page size must be between 10 and 100' })
      }
    }

    const whitelistPluginIds = parsePluginIds(pluginIds)
    const usingPluginFilter =
      whitelistPluginIds != null && whitelistPluginIds.length > 0

    const selector = buildMangoSelector({
      chainPluginIds: whitelistPluginIds
    })

    const result = await getTokenDocs({
      selector,
      useIndex: chooseRankIndex(usingPluginFilter),
      limit: pageSize,
      skip: page * pageSize
    })

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
