import { asMaybe } from 'cleaners'

import type { EdgeAsset } from '../../types'
import { createTokenId } from '../../utils'
import type { CoingeckoClient } from './evidence/coingecko'
import type { ChainDocs } from './evidence/gather'
import {
  asCoingeckoList,
  asCoingeckoListCoin,
  type SearchHit
} from './evidence/types'
import type { Resolution } from './resolveAsset'

export interface CalibrationSample {
  asset: EdgeAsset
  key: string
  /** The CoinGecko id the asset really is. */
  coingeckoId: string
  /** Same asset as `expectedId`, or a look-alike of it. */
  expectedId: string
  positive: boolean
  note: string
}

/** A small deterministic generator so samples repeat across runs. */
const makeRandom = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const shuffle = <T>(items: T[], random: () => number): T[] => {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Builds labelled pairs from CoinGecko's own listings: positives are a
 * coin's deployments on chains beyond its primary one, negatives are coins
 * that share a top coin's symbol under a different id.
 */
export const buildCalibrationSamples = async (
  coingecko: CoingeckoClient,
  docs: ChainDocs,
  topCoins: SearchHit[],
  opts: { pairs: number; seed: number }
): Promise<CalibrationSample[]> => {
  const { status, body } = await coingecko.get(
    '/coins/list?include_platform=true'
  )
  if (status !== 200) throw new Error(`coingecko list replied ${status}`)
  const platformToPluginId: Record<string, string> = {}
  for (const [pluginId, platformId] of Object.entries(docs.platforms)) {
    if (platformId != null && docs.tokenTypes[pluginId] != null) {
      platformToPluginId[platformId] = pluginId
    }
  }
  const topBySymbol = new Map<string, SearchHit>()
  for (const coin of topCoins) {
    if (coin.marketCapRank != null && coin.marketCapRank <= 100) {
      topBySymbol.set(coin.symbol.toLowerCase(), coin)
    }
  }

  const positives: CalibrationSample[] = []
  const negatives: CalibrationSample[] = []
  for (const raw of asCoingeckoList(body)) {
    const coin = asMaybe(asCoingeckoListCoin)(raw)
    if (coin == null) continue
    const deployments: EdgeAsset[] = []
    for (const [platformId, address] of Object.entries(coin.platforms)) {
      const pluginId = platformToPluginId[platformId]
      const tokenType = docs.tokenTypes[pluginId]
      if (
        pluginId == null ||
        tokenType == null ||
        address == null ||
        address === ''
      )
        continue
      try {
        const tokenId = createTokenId(tokenType, coin.symbol, address)
        if (tokenId != null) deployments.push({ pluginId, tokenId })
      } catch (error: unknown) {
        continue
      }
    }
    const top = topBySymbol.get(coin.symbol.toLowerCase())
    if (top != null && top.id !== coin.id && deployments.length > 0) {
      const asset = deployments[0]
      negatives.push({
        asset,
        key: `${asset.pluginId}_${asset.tokenId ?? ''}`,
        coingeckoId: coin.id,
        expectedId: top.id,
        positive: false,
        note: `${coin.id} shares the symbol of ${top.id}`
      })
    } else if (deployments.length >= 2) {
      const asset = deployments[1]
      positives.push({
        asset,
        key: `${asset.pluginId}_${asset.tokenId ?? ''}`,
        coingeckoId: coin.id,
        expectedId: coin.id,
        positive: true,
        note: `${coin.id} deployed on ${String(
          deployments.length
        )} mapped chains`
      })
    }
  }
  const random = makeRandom(opts.seed)
  const half = Math.ceil(opts.pairs / 2)
  return [
    ...shuffle(positives, random).slice(0, half),
    ...shuffle(negatives, random).slice(0, opts.pairs - half)
  ]
}

export interface CalibrationRow {
  key: string
  positive: boolean
  expectedId: string
  /** Whether the resolver's claim matched the expectation. */
  claimedId?: string
  status: string
  confidence?: number
  scamSignals: string[]
}

export interface CalibrationReport {
  samples: number
  positives: number
  negatives: number
  claimedCorrect: number
  claimedWrong: number
  falseSame: number
  unresolved: number
  scamFlaggedPositives: number
  brierScore?: number
  buckets: Array<{ floor: number; count: number; correct: number }>
  thresholds: Array<{
    threshold: number
    precision: number
    recall: number
    applies: number
  }>
  recommendedThreshold?: number
}

const bucketFloors = [0, 0.5, 0.7, 0.8, 0.9, 0.95]

/** Scores resolutions against their labels: precision per threshold, Brier score, reliability buckets. */
export const scoreCalibration = (
  samples: CalibrationSample[],
  resolutions: Map<string, Resolution>
): { rows: CalibrationRow[]; report: CalibrationReport } => {
  const rows: CalibrationRow[] = samples.map(sample => {
    const resolution = resolutions.get(sample.key)
    return {
      key: sample.key,
      positive: sample.positive,
      expectedId: sample.expectedId,
      claimedId: resolution?.outcome.coingeckoId,
      status: resolution?.outcome.status ?? 'missing',
      confidence: resolution?.outcome.confidence,
      scamSignals: resolution?.signals.map(signal => signal.name) ?? []
    }
  })
  const claims = rows.filter(
    row => row.claimedId != null && row.confidence != null
  )
  const isCorrect = (row: CalibrationRow): boolean =>
    row.positive
      ? row.claimedId === row.expectedId
      : row.claimedId !== row.expectedId

  let brier = 0
  for (const row of claims) {
    const truth = isCorrect(row) ? 1 : 0
    brier += (Number(row.confidence) - truth) ** 2
  }
  const buckets = bucketFloors.map((floor, index) => {
    const ceiling = bucketFloors[index + 1] ?? 1.01
    const inBucket = claims.filter(
      row => Number(row.confidence) >= floor && Number(row.confidence) < ceiling
    )
    return {
      floor,
      count: inBucket.length,
      correct: inBucket.filter(isCorrect).length
    }
  })
  const thresholds = [0.5, 0.7, 0.8, 0.9, 0.95, 0.98].map(threshold => {
    const applies = claims.filter(row => Number(row.confidence) >= threshold)
    const correct = applies.filter(isCorrect).length
    const positives = rows.filter(row => row.positive).length
    return {
      threshold,
      precision: applies.length === 0 ? 1 : correct / applies.length,
      recall:
        positives === 0
          ? 0
          : applies.filter(row => row.positive && isCorrect(row)).length /
            positives,
      applies: applies.length
    }
  })
  const recommended = thresholds.find(
    row => row.precision >= 0.98 && row.applies >= 20
  )
  const report: CalibrationReport = {
    samples: rows.length,
    positives: rows.filter(row => row.positive).length,
    negatives: rows.filter(row => !row.positive).length,
    claimedCorrect: claims.filter(isCorrect).length,
    claimedWrong: claims.filter(row => !isCorrect(row)).length,
    falseSame: rows.filter(
      row => !row.positive && row.claimedId === row.expectedId
    ).length,
    unresolved: rows.filter(row => row.claimedId == null).length,
    scamFlaggedPositives: rows.filter(
      row => row.positive && row.status === 'suspected_scam'
    ).length,
    brierScore: claims.length === 0 ? undefined : brier / claims.length,
    buckets,
    thresholds,
    recommendedThreshold: recommended?.threshold
  }
  return { rows, report }
}
