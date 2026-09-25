import { asArray, asMaybe, asNumber, asObject, asOptional } from 'cleaners'

import { assetResolverActive, config } from '../../../config'
import { REDIS_COINRANK_KEY_PREFIX } from '../../../constants'
import { postSlackText } from '../../../utils/postToSlack'
import { dateOnly } from '../../../utils/utils'
import type { EdgeAsset, RateEngine } from '../../types'
import { client } from '../redis'
import { prepareRunDir, readVerdictsText, runAgent } from './agent'
import {
  type BatchEntry,
  buildBatch,
  indexVerdicts,
  instructionsVersion,
  parseVerdictsFile
} from './batch'
import { maxDrainedAssets } from './constants'
import {
  applyCrossChainEntry,
  loadResolverDocs,
  removeCrossChainEntry,
  type ResolverDocs,
  saveBatchRecord,
  saveProposals
} from './docs'
import { fetchAddressIndex, makeCoingeckoClient } from './evidence/coingecko'
import { gatherEvidence } from './evidence/gather'
import { issuerRegistry } from './evidence/issuerRegistry'
import { makeTokenListLookup } from './evidence/tokenLists'
import { loadTopCoins } from './evidence/topCoins'
import { fetchJson } from './evidence/types'
import { type Judge, selectJudge } from './judge'
import {
  agentSummary,
  classReportSections,
  formatReport,
  type ReportedAsset,
  type ResolvedLine,
  type ResolverReport,
  resolverReportSections,
  selectReportedAssets
} from './report'
import {
  decide,
  type Resolution,
  resolutionSymbol,
  type ResolveDeps,
  resolveDeterministic,
  toCrossChainEntry,
  toProposal
} from './resolveAsset'
import { findSuperseded, selectResearchCandidates } from './selection'
import {
  claimDailyRun,
  drainUnresolvedAssets,
  finishDrain,
  releaseDailyRun
} from './store'
import type { Proposal } from './types'

const ignoreFooter =
  'Silence an entry: add "pluginId_tokenId": { "reason": "...", "until": "YYYY-MM-DD" } to rates_settings/assetResolver'

const asLocalRates = asObject({
  crypto: asArray(asObject({ rate: asOptional(asNumber) }))
})

/** What this server prices an asset at right now, through the whole pipeline. */
export const fetchLocalUsdRate = async (
  asset: EdgeAsset
): Promise<number | undefined> => {
  try {
    const { status, body } = await fetchJson(
      `http://${config.httpHost}:${config.httpPort}/v3/rates`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          targetFiat: 'USD',
          crypto: [{ asset, rate: undefined }],
          fiat: []
        })
      }
    )
    if (status !== 200) return
    return asMaybe(asLocalRates)(body)?.crypto[0]?.rate
  } catch (error: unknown) {
    return undefined
  }
}

/** The dependencies one run shares across every asset it researches. */
export const makeResolveDeps = async (
  docs: ResolverDocs,
  rightNow: Date
): Promise<ResolveDeps> => {
  const { research, judge, scam, autoApply } = config.assetResolver
  const coingecko = makeCoingeckoClient({
    uri: config.providers.coingeckopro.uri,
    apiKey: config.providers.coingeckopro.apiKey,
    fetchJson,
    spacingMs: research.coingeckoSpacingMs
  })
  const platformToPluginId: Record<string, string> = {}
  for (const [pluginId, platformId] of Object.entries(docs.context.platforms)) {
    if (platformId != null) platformToPluginId[platformId] = pluginId
  }
  let addressIndex: ReturnType<typeof fetchAddressIndex> | undefined
  const topCoins = await loadTopCoins({
    readCoinrank: async () =>
      await client.get(
        `${REDIS_COINRANK_KEY_PREFIX}_${config.defaultFiatCode}`
      ),
    coingecko
  })
  const judgeOpts = {
    fetchJson,
    typesafeApiKey: judge.typesafeApiKey,
    jevModel: judge.jevModel
  }
  const shadowJudge: Judge | undefined =
    judge.shadow === 'agent' || judge.shadow === 'jev'
      ? selectJudge(judge.shadow, judgeOpts)
      : undefined

  return {
    docs,
    gather: async (asset, chainDocs, opts) =>
      await gatherEvidence(
        asset,
        chainDocs,
        {
          fetchJson,
          coingecko,
          addressIndex: async () => {
            addressIndex ??= fetchAddressIndex(coingecko, platformToPluginId)
            return await addressIndex
          },
          tokenLists: makeTokenListLookup(fetchJson),
          registry: issuerRegistry,
          goplusApiKey: research.goplusApiKey,
          etherscanApiKey: research.etherscanApiKey
        },
        opts
      ),
    topCoins,
    getUsdRate: fetchLocalUsdRate,
    judge: selectJudge(judge.kind === 'jev' ? 'jev' : 'agent', judgeOpts),
    shadowJudge,
    config: {
      scam,
      autoApply,
      retry: {
        retryDays: research.retryDays,
        scamRecheckDays: research.scamRecheckDays
      }
    },
    rightNow
  }
}

const toLine = (resolution: Resolution): ResolvedLine => ({
  key: resolution.key,
  symbol: resolutionSymbol(resolution),
  status: resolution.outcome.status,
  coingeckoId: resolution.outcome.coingeckoId,
  relationship: resolution.outcome.relationship,
  confidence: resolution.outcome.confidence,
  judge: resolution.outcome.judge,
  destinationKey: resolution.destination?.key,
  reasons: resolution.outcome.reasons,
  signals: resolution.signals.map(signal => signal.name)
})

export interface ResearchRun {
  report: ResolverReport
  proposals: Map<string, Proposal>
  researchedKeys: Set<string>
}

/**
 * Writes an applied mapping, or turns the outcome into a proposal when the
 * write is refused. Returns the entry written.
 */
export const applyResolution = async (
  resolution: Resolution
): Promise<ReturnType<typeof toCrossChainEntry>> => {
  if (resolution.outcome.status !== 'applied') return
  const entry = toCrossChainEntry(resolution)
  if (entry == null) {
    resolution.outcome = {
      ...resolution.outcome,
      status: 'proposed',
      reasons: ['no destination to write']
    }
    return
  }
  try {
    await applyCrossChainEntry(resolution.key, entry)
    return entry
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    resolution.outcome = {
      ...resolution.outcome,
      status: 'proposed',
      reasons: [`apply failed: ${message}`]
    }
  }
}

/**
 * Researches the selected assets: the scripted pass first, then one agent
 * batch for whatever it could not settle, then the policy on every verdict.
 */
export const researchAssets = async (
  entries: ReportedAsset[],
  docs: ResolverDocs,
  rightNow: Date,
  deps?: ResolveDeps
): Promise<ResearchRun> => {
  const { research, agent } = config.assetResolver
  const proposals = new Map<string, Proposal>()
  const report: ResolverReport = { resolved: [], superseded: [] }
  const researchedKeys = new Set<string>()
  const candidates = selectResearchCandidates(entries, docs.proposals, {
    rightNow,
    minRequestCount: research.minRequestCount,
    maxAssetsPerRun: research.maxAssetsPerRun
  })
  if (candidates.length === 0) return { report, proposals, researchedKeys }

  const resolveDeps = deps ?? (await makeResolveDeps(docs, rightNow))
  let appliesThisRun = 0
  const finish = async (
    resolution: Resolution,
    extra: Parameters<typeof toProposal>[3] = {}
  ): Promise<void> => {
    const appliedEntry = await applyResolution(resolution)
    if (appliedEntry != null) appliesThisRun++
    proposals.set(
      resolution.key,
      toProposal(resolution, docs.proposals[resolution.key], rightNow, {
        ...extra,
        appliedEntry
      })
    )
    report.resolved.push(toLine(resolution))
  }

  const pending: Array<{ entry: ReportedAsset; resolution: Resolution }> = []
  for (const entry of candidates) {
    researchedKeys.add(entry.key)
    const [pluginId, tokenId] = entry.key.split('_')
    const asset: EdgeAsset = { pluginId, tokenId: tokenId ?? null }
    try {
      const resolution = await resolveDeterministic(
        asset,
        entry.assetClass,
        resolveDeps,
        {
          appliesThisRun,
          requestCount: entry.count
        }
      )
      if (resolution.outcome.status === 'awaiting_agent') {
        pending.push({ entry, resolution })
      } else {
        await finish(resolution)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`assetResolver: research failed for ${entry.key}`, error)
      report.resolved.push({
        key: entry.key,
        status: 'error',
        judge: 'none',
        reasons: [message],
        signals: []
      })
    }
  }

  if (pending.length > 0) {
    const batchEntries: BatchEntry[] = pending
      .slice(0, agent.maxAssetsPerBatch)
      .map(({ entry, resolution }) => ({
        key: resolution.key,
        asset: resolution.asset,
        assetClass: resolution.assetClass,
        requestCount: entry.count,
        evidence: resolution.evidence,
        scamSignals: resolution.signals,
        candidates: resolution.candidates
      }))
    const batch = buildBatch(batchEntries, rightNow)
    report.batch = { batchId: batch.batchId, assetCount: batchEntries.length }
    const inBatch = new Set(batchEntries.map(entry => entry.key))
    let verdicts = new Map<
      string,
      ReturnType<typeof indexVerdicts> extends Map<string, infer V> ? V : never
    >()
    try {
      const runDir = await prepareRunDir(agent.runRoot, batch)
      await saveBatchRecord(batch.batchId, {
        status: 'running',
        createdAt: batch.createdAt,
        runDir: runDir.dir,
        assetCount: batchEntries.length
      })
      const result = await runAgent({
        runDir: runDir.dir,
        command: agent.command,
        model: agent.model,
        apiKey: config.assetResolver.cursorApiKey,
        timeoutSeconds: agent.timeoutSeconds
      })
      const text = await readVerdictsText(runDir.verdictsPath)
      if (text == null) {
        throw new Error(
          result.timedOut
            ? `timed out after ${String(agent.timeoutSeconds)}s`
            : `agent exited ${String(
                result.exitCode
              )} without writing verdicts.json`
        )
      }
      const file = parseVerdictsFile(text, {
        batchId: batch.batchId,
        instructionsVersion,
        keys: batchEntries.map(entry => entry.key)
      })
      verdicts = indexVerdicts(file)
      report.batch.verdictCount = verdicts.size
      await saveBatchRecord(batch.batchId, {
        status: 'ingested',
        createdAt: batch.createdAt,
        runDir: runDir.dir,
        assetCount: batchEntries.length,
        verdictCount: verdicts.size
      })
      for (const { entry, resolution } of pending) {
        if (!inBatch.has(resolution.key)) continue
        const verdict = verdicts.get(resolution.key)
        const decided = await decide(resolution, verdict, resolveDeps, {
          appliesThisRun,
          requestCount: entry.count
        })
        await finish(decided, {
          batchId: batch.batchId,
          instructionsVersion,
          agent: file.agent
        })
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`assetResolver: agent batch ${batch.batchId} failed`, error)
      report.agentError = message
      await saveBatchRecord(batch.batchId, {
        status: 'agent_error',
        createdAt: batch.createdAt,
        assetCount: batchEntries.length,
        error: message
      }).catch((saveError: unknown) => {
        console.error(
          'assetResolver: could not record the batch failure',
          saveError
        )
      })
      for (const { resolution } of pending) {
        if (!inBatch.has(resolution.key)) continue
        resolution.outcome = {
          ...resolution.outcome,
          status: 'awaiting_agent',
          reasons: [message]
        }
        await finish(resolution, {
          batchId: batch.batchId,
          instructionsVersion,
          error: message
        })
      }
    }
    // Pending assets beyond the batch cap wait for the next run:
    for (const { resolution } of pending) {
      if (inBatch.has(resolution.key)) continue
      researchedKeys.delete(resolution.key)
    }
  }
  return { report, proposals, researchedKeys }
}

/** Retires proposals that another document now covers, removing applied AI entries. */
export const supersedeProposals = async (
  docs: ResolverDocs,
  rightNow: Date
): Promise<{ keys: string[]; proposals: Map<string, Proposal> }> => {
  const contextWithoutAi = {
    ...docs.context,
    crossChain: { ...docs.automatedCrossChain, ...docs.manualCrossChain }
  }
  const keys = findSuperseded(docs.proposals, contextWithoutAi)
  const proposals = new Map<string, Proposal>()
  for (const key of keys) {
    const prior = docs.proposals[key]
    if (prior.status === 'applied') await removeCrossChainEntry(key)
    proposals.set(key, {
      ...prior,
      status: 'superseded',
      lastAttempt: rightNow.toISOString(),
      nextAttemptAfter: undefined
    })
  }
  return { keys, proposals }
}

/**
 * Drains the recorded assets, researches what it can, reports everything,
 * and forgets the drained keys. Returns the posted text, for the CLI and
 * for logs.
 */
export const runDailyReport = async (
  rightNow: Date
): Promise<string | undefined> => {
  const day = dateOnly(rightNow.toISOString())
  const counts = await drainUnresolvedAssets(maxDrainedAssets)
  const docs = await loadResolverDocs()

  const superseded = await supersedeProposals(docs, rightNow)
  const selection = selectReportedAssets(counts, {
    context: docs.context,
    ignore: docs.ignore,
    rightNow,
    topN: config.assetResolver.reportTopN
  })
  const research = await researchAssets(selection.entries, docs, rightNow)
  research.report.superseded = superseded.keys
  await saveProposals(new Map([...superseded.proposals, ...research.proposals]))

  const notResearched = selection.entries.filter(
    entry => !research.researchedKeys.has(entry.key)
  )
  const footer = [ignoreFooter]
  if (docs.ignoreWarning != null) footer.unshift(docs.ignoreWarning)
  const summary = agentSummary(research.report)
  const text = formatReport({
    day,
    selection,
    sections: [
      ...resolverReportSections(research.report),
      ...classReportSections(notResearched)
    ],
    footer: summary == null ? footer : [summary, ...footer]
  })

  if (text != null) {
    console.log(text)
    const webhookUrl =
      config.assetResolver.slackWebhookUrl !== ''
        ? config.assetResolver.slackWebhookUrl
        : config.slackWebhookUrl
    if (webhookUrl !== '') await postSlackText(webhookUrl, text)
  }
  await finishDrain()
  return text
}

/** Hourly tick that runs the report once per UTC day, after the configured hour. */
export const dailyEngine: RateEngine = async () => {
  if (!assetResolverActive) return
  const rightNow = new Date()
  if (rightNow.getUTCHours() < config.assetResolver.runAfterUtcHour) return

  const day = dateOnly(rightNow.toISOString())
  if (!(await claimDailyRun(day, rightNow))) return
  try {
    await runDailyReport(rightNow)
  } catch (error: unknown) {
    await releaseDailyRun(day)
    throw error
  }
}
