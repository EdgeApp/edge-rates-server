import type { EdgeAsset } from '../../types'
import { toCryptoKey } from '../../utils'
import type { BatchCandidate } from './batch'
import { isIgnored, isMappedNow, type UnresolvedAssetClass } from './classify'
import {
  buildMappedAssets,
  deriveDestination,
  type Destination,
  type DestinationContext
} from './destination'
import type { ResolverDocs } from './docs'
import type { ChainDocs, GatherOptions } from './evidence/gather'
import type { AssetEvidence, SearchHit } from './evidence/types'
import type { Judge, JudgeVerdict } from './judge'
import {
  type AutoApplyConfig,
  decideProposal,
  type PolicyOutcome,
  type RetryConfig
} from './policy'
import { findProvenance, type ProvenanceProof } from './provenance'
import {
  detectScamSignals,
  ownIdentity,
  type ScamConfig,
  type ScamSignal
} from './scam'
import type { CrossChainEntry, Proposal, Verdict } from './types'

export interface ResolveDeps {
  docs: ResolverDocs
  gather: (
    asset: EdgeAsset,
    docs: ChainDocs,
    opts: GatherOptions
  ) => Promise<AssetEvidence>
  topCoins: SearchHit[]
  /** The USD rate the rates server returns for an asset today, if any. */
  getUsdRate: (asset: EdgeAsset) => Promise<number | undefined>
  judge: Judge
  shadowJudge?: Judge
  config: { scam: ScamConfig; autoApply: AutoApplyConfig; retry: RetryConfig }
  rightNow: Date
}

export interface ResolveOptions {
  blind?: boolean
  forced?: boolean
  appliesThisRun: number
  requestCount: number
}

export interface Resolution {
  key: string
  asset: EdgeAsset
  assetClass: UnresolvedAssetClass
  requestCount: number
  evidence: AssetEvidence
  signals: ScamSignal[]
  proof?: ProvenanceProof
  candidates: BatchCandidate[]
  destination?: Destination
  destinationRate?: number
  verdict?: Verdict
  judged?: JudgeVerdict
  shadow?: JudgeVerdict
  outcome: PolicyOutcome
}

const priceDelta = (
  price: number | undefined,
  rate: number | undefined
): number | undefined =>
  price != null && rate != null && rate > 0
    ? Math.abs(price - rate) / rate
    : undefined

const destinationContext = (docs: ResolverDocs): DestinationContext => ({
  coingeckoMap: docs.coingeckoMap,
  crossChainSources: new Set([
    ...Object.keys(docs.automatedCrossChain),
    ...Object.keys(docs.aiCrossChain),
    ...Object.keys(docs.manualCrossChain)
  ]),
  platformPriority: docs.platformPriority
})

/**
 * Gathers evidence and decides what the scripted sources can decide on
 * their own. An `awaiting_agent` outcome means the agent must weigh in.
 */
export const resolveDeterministic = async (
  asset: EdgeAsset,
  assetClass: UnresolvedAssetClass,
  deps: ResolveDeps,
  opts: ResolveOptions
): Promise<Resolution> => {
  const { docs } = deps
  const key = toCryptoKey(asset)
  const evidence = await deps.gather(asset, docs.context, { blind: opts.blind })
  const signals = detectScamSignals(evidence, deps.topCoins, deps.config.scam)
  const proof = findProvenance(evidence, buildMappedAssets(docs.coingeckoMap))

  const context = destinationContext(docs)
  const rates = new Map<string, Promise<number | undefined>>()
  const rateFor = async (
    destination: Destination
  ): Promise<number | undefined> => {
    let rate = rates.get(destination.key)
    if (rate == null) {
      rate = deps.getUsdRate(destination.asset)
      rates.set(destination.key, rate)
    }
    return await rate
  }
  const candidates: BatchCandidate[] = []
  for (const coin of evidence.coingecko.candidates) {
    const destination = deriveDestination(coin.id, context)
    // Edge's own rate first, CoinGecko's price when the server has none yet:
    const usdRate =
      destination == null
        ? undefined
        : (await rateFor(destination)) ?? coin.priceUsd
    candidates.push({
      ...coin,
      destination:
        destination == null
          ? undefined
          : { key: destination.key, asset: destination.asset, usdRate },
      priceDelta: priceDelta(evidence.defiLlama?.price, usdRate)
    })
  }

  const resolution: Resolution = {
    key,
    asset,
    assetClass,
    requestCount: opts.requestCount,
    evidence,
    signals,
    proof,
    candidates,
    outcome: {
      status: 'awaiting_agent',
      judge: 'none',
      guards: [],
      reasons: []
    }
  }
  return await decide(resolution, undefined, deps, opts)
}

/**
 * Applies the policy to gathered evidence, with the agent's verdict when it
 * has one. Judges only score agent verdicts; proofs carry fixed confidences.
 */
export const decide = async (
  resolution: Resolution,
  verdict: Verdict | undefined,
  deps: ResolveDeps,
  opts: ResolveOptions
): Promise<Resolution> => {
  const { docs, config, rightNow } = deps
  const { key, evidence, signals, proof, candidates } = resolution

  const claimedId =
    proof?.coingeckoId ??
    (verdict?.decision === 'same_asset'
      ? verdict.coingeckoId ?? undefined
      : undefined)
  let destination: Destination | undefined
  let destinationRate: number | undefined
  if (claimedId != null) {
    const candidate = candidates.find(coin => coin.id === claimedId)
    if (candidate?.destination != null) {
      destination = { ...candidate.destination, priority: 0 }
      destinationRate = candidate.destination.usdRate
    } else {
      destination = deriveDestination(claimedId, destinationContext(docs))
      if (destination != null)
        destinationRate = await deps.getUsdRate(destination.asset)
    }
  }

  let judged: JudgeVerdict | undefined
  let shadow: JudgeVerdict | undefined
  let gated = verdict
  if (verdict != null && proof == null) {
    const candidate = candidates.find(coin => coin.id === verdict.coingeckoId)
    const input = { evidence, signals, verdict, candidate }
    judged = await deps.judge.judge(input)
    if (deps.shadowJudge != null) {
      try {
        shadow = await deps.shadowJudge.judge(input)
      } catch (error: unknown) {
        console.error(`assetResolver: shadow judge failed for ${key}`, error)
      }
    }
    if (judged != null) gated = { ...verdict, confidence: judged.probability }
  }

  const outcome = decideProposal({
    proof,
    signals,
    verdict: gated,
    destination,
    destinationRate,
    independentPrice: evidence.defiLlama?.price,
    ignored: isIgnored(docs.ignore[key], rightNow),
    manualEntryExists:
      docs.manualCrossChain[key] != null || docs.manualCoingecko[key] != null,
    stillUnresolved: !isMappedNow(docs.context, key),
    forced: opts.forced ?? false,
    autoApply: config.autoApply,
    appliesThisRun: opts.appliesThisRun,
    attempts: docs.proposals[key]?.attempts ?? 0,
    rightNow,
    retry: config.retry
  })
  return {
    ...resolution,
    destination,
    destinationRate,
    verdict,
    judged,
    shadow,
    outcome
  }
}

/** The asset's own symbol as the sources report it, or the claimed coin's. */
export const resolutionSymbol = (
  resolution: Resolution
): string | undefined => {
  const own = ownIdentity(resolution.evidence).symbols[0]
  if (own != null) return own.toUpperCase()
  const claimed = resolution.candidates.find(
    coin => coin.id === resolution.outcome.coingeckoId
  )
  return claimed?.symbol.toUpperCase()
}

/** The cross-chain entry an applied resolution writes. */
export const toCrossChainEntry = (
  resolution: Resolution
): CrossChainEntry | undefined => {
  const { destination, asset } = resolution
  if (destination == null) return
  return {
    sourceChain: asset.pluginId,
    destChain: destination.asset.pluginId,
    currencyCode:
      resolutionSymbol(resolution) ?? resolution.outcome.coingeckoId ?? '',
    tokenId: destination.asset.tokenId ?? null
  }
}

/** The proposal record a resolution leaves behind. */
export const toProposal = (
  resolution: Resolution,
  prior: Proposal | undefined,
  rightNow: Date,
  extra: {
    batchId?: string
    instructionsVersion?: number
    agent?: Proposal['agent']
    appliedEntry?: CrossChainEntry
    error?: string
  } = {}
): Proposal => {
  const { outcome } = resolution
  const now = rightNow.toISOString()
  return {
    asset: resolution.asset,
    assetClass: resolution.assetClass,
    status: outcome.status,
    coingeckoId: outcome.coingeckoId,
    relationship: outcome.relationship,
    confidence: outcome.confidence,
    judge: resolution.judged,
    shadowJudge: resolution.shadow,
    provenance: resolution.proof,
    scamSignals: resolution.signals,
    guards: outcome.guards,
    reasons: outcome.reasons,
    destination:
      resolution.destination == null
        ? undefined
        : {
            key: resolution.destination.key,
            asset: resolution.destination.asset
          },
    verdict: resolution.verdict,
    batchId: extra.batchId ?? prior?.batchId,
    instructionsVersion:
      extra.instructionsVersion ?? prior?.instructionsVersion,
    agent: extra.agent ?? prior?.agent,
    requestCount: resolution.requestCount,
    attempts: (prior?.attempts ?? 0) + 1,
    firstSeen: prior?.firstSeen ?? now,
    lastAttempt: now,
    nextAttemptAfter: outcome.nextAttemptAfter,
    appliedAt: outcome.status === 'applied' ? now : prior?.appliedAt,
    rolledBackAt: prior?.rolledBackAt,
    appliedEntry: extra.appliedEntry ?? prior?.appliedEntry,
    error: extra.error
  }
}
