import { asArray, asJSON, asObject } from 'cleaners'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'

import { config } from '../src/config'
import { postSlackText } from '../src/utils/postToSlack'
import {
  expandHome,
  prepareRunDir
} from '../src/v3/providers/assetResolver/agent'
import {
  asVerdictsFile,
  type BatchEntry,
  type BatchFile,
  buildBatch,
  instructionsVersion,
  parseVerdictsFile
} from '../src/v3/providers/assetResolver/batch'
import {
  buildCalibrationSamples,
  scoreCalibration
} from '../src/v3/providers/assetResolver/calibrate'
import { classifyUnresolvedAsset } from '../src/v3/providers/assetResolver/classify'
import {
  flagNumber,
  flagString,
  parseCliArgs,
  positionalAsset,
  usage
} from '../src/v3/providers/assetResolver/cliArgs'
import {
  addIgnoreEntry,
  loadResolverDocs,
  readSettingsDoc,
  removeCrossChainEntry,
  removeIgnoreEntry,
  type ResolverDocs,
  saveProposals
} from '../src/v3/providers/assetResolver/docs'
import {
  applyResolution,
  ingestVerdicts,
  makeResolveDeps,
  runAgentOnBatch,
  runDailyReport
} from '../src/v3/providers/assetResolver/engine'
import { makeCoingeckoClient } from '../src/v3/providers/assetResolver/evidence/coingecko'
import { fetchJson } from '../src/v3/providers/assetResolver/evidence/types'
import { renderJudgeState } from '../src/v3/providers/assetResolver/judgeState'
import {
  agentSummary,
  formatReport,
  type ResolvedLine,
  resolverReportSections
} from '../src/v3/providers/assetResolver/report'
import {
  type Resolution,
  resolutionSymbol,
  type ResolveDeps,
  resolveDeterministic,
  toCrossChainEntry,
  toProposal
} from '../src/v3/providers/assetResolver/resolveAsset'
import {
  asBatchMap,
  asProposalMap,
  type Proposal
} from '../src/v3/providers/assetResolver/types'
import type { EdgeAsset } from '../src/v3/types'
import { asEdgeAsset } from '../src/v3/types'
import { toCryptoKey } from '../src/v3/utils'

const asAssetList = asJSON(asArray(asEdgeAsset))
const asBatchJson = asJSON(
  asObject({
    batchId: (raw: unknown) => String(raw),
    instructionsVersion: (raw: unknown) => Number(raw),
    createdAt: (raw: unknown) => String(raw),
    entries: asArray((raw: unknown) => raw as BatchEntry)
  })
)

const readAssets = async (
  positionals: string[],
  file: string | undefined
): Promise<EdgeAsset[]> => {
  if (file != null) return asAssetList(await readFile(file, 'utf8'))
  const asset = positionalAsset(positionals)
  if (asset == null)
    throw new Error('Give <pluginId> [tokenId] or --file assets.json')
  return [asset]
}

const readBatch = async (
  batchId: string
): Promise<{ batch: BatchFile; dir: string }> => {
  const dir = path.join(expandHome(config.assetResolver.agent.runRoot), batchId)
  const batch = asBatchJson(
    await readFile(path.join(dir, 'batch.json'), 'utf8')
  )
  return { batch, dir }
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

const printResolution = (resolution: Resolution): void => {
  console.log(`\n== ${resolution.key} (${resolution.assetClass})`)
  console.log(
    renderJudgeState({
      evidence: resolution.evidence,
      signals: resolution.signals,
      proof: resolution.proof,
      verdict: resolution.verdict,
      candidate: resolution.candidates.find(
        coin => coin.id === resolution.outcome.coingeckoId
      )
    })
  )
  if (resolution.evidence.errors.length > 0) {
    console.log(
      `Source errors: ${resolution.evidence.errors
        .map(error => `${error.source}: ${error.message}`)
        .join('; ')}`
    )
  }
  for (const coin of resolution.candidates) {
    const destination =
      coin.destination == null
        ? 'no Edge destination'
        : `-> ${coin.destination.key} rate ${String(
            coin.destination.usdRate ?? 'none'
          )}`
    console.log(
      `Candidate ${coin.id} (${coin.symbol}, rank ${String(
        coin.marketCapRank ?? 'none'
      )}) ${destination}${
        coin.priceDelta != null
          ? ` delta ${String(Math.round(coin.priceDelta * 10000) / 100)}%`
          : ''
      }`
    )
  }
  if (resolution.outcome.guards.length > 0) {
    console.log(
      `Guards: ${resolution.outcome.guards
        .map(
          guard =>
            `${guard.name} ${guard.passed ? 'ok' : 'FAIL'}${
              guard.passed ? '' : ` (${guard.detail})`
            }`
        )
        .join(' | ')}`
    )
  }
  const { outcome } = resolution
  console.log(
    `Decision: ${outcome.status}${
      outcome.coingeckoId != null ? ` as ${outcome.coingeckoId}` : ''
    }${outcome.reasons.length > 0 ? ` (${outcome.reasons.join(', ')})` : ''}`
  )
  const entry =
    outcome.status === 'applied' || outcome.status === 'proposed'
      ? toCrossChainEntry(resolution)
      : undefined
  if (entry != null)
    console.log(
      `Cross-chain entry: ${JSON.stringify({ [resolution.key]: entry })}`
    )
}

/** The scripted pass for a list of assets, in request order. */
const resolveAll = async (
  assets: EdgeAsset[],
  docs: ResolverDocs,
  deps: ResolveDeps,
  opts: { blind: boolean; forced: boolean }
): Promise<Resolution[]> => {
  const out: Resolution[] = []
  let appliesThisRun = 0
  for (const asset of assets) {
    const key = toCryptoKey(asset)
    const assetClass = classifyUnresolvedAsset(docs.context, key)
    if (assetClass !== 'unmapped-token' && assetClass !== 'unmapped-native') {
      if (!opts.blind || assetClass !== 'mapped-unpriced') {
        console.log(`\n== ${key}: ${assetClass}, nothing to resolve`)
        continue
      }
    }
    const resolution = await resolveDeterministic(
      asset,
      assetClass === 'mapped-unpriced' ? 'unmapped-token' : assetClass,
      deps,
      {
        blind: opts.blind,
        forced: opts.forced,
        appliesThisRun,
        requestCount: docs.proposals[key]?.requestCount ?? 0
      }
    )
    if (resolution.outcome.status === 'applied') appliesThisRun++
    out.push(resolution)
  }
  return out
}

/** Runs the agent on the resolutions still waiting for it and decides them. */
const runAgentFor = async (
  resolutions: Resolution[],
  deps: ResolveDeps,
  opts: { forced: boolean; ingest: boolean }
): Promise<{
  resolutions: Resolution[]
  batch?: BatchFile
  file?: Awaited<ReturnType<typeof runAgentOnBatch>>
}> => {
  const pending = resolutions.filter(
    resolution => resolution.outcome.status === 'awaiting_agent'
  )
  if (pending.length === 0) return { resolutions }
  const batch = buildBatch(
    pending
      .slice(0, config.assetResolver.agent.maxAssetsPerBatch)
      .map(resolution => ({
        key: resolution.key,
        asset: resolution.asset,
        assetClass: resolution.assetClass,
        requestCount: resolution.requestCount,
        evidence: resolution.evidence,
        scamSignals: resolution.signals,
        candidates: resolution.candidates
      })),
    deps.rightNow
  )
  const runDir = await prepareRunDir(config.assetResolver.agent.runRoot, batch)
  console.log(`\nRunning the agent on batch ${batch.batchId} in ${runDir.dir}`)
  const file = await runAgentOnBatch(batch, runDir)
  if (!opts.ingest) return { resolutions, batch, file }
  const decided = await ingestVerdicts(batch, file, deps, {
    forced: opts.forced,
    appliesThisRun: 0
  })
  const byKey = new Map(decided.map(resolution => [resolution.key, resolution]))
  return {
    resolutions: resolutions.map(
      resolution => byKey.get(resolution.key) ?? resolution
    ),
    batch,
    file
  }
}

const recordAndReport = async (
  resolutions: Resolution[],
  docs: ResolverDocs,
  rightNow: Date,
  opts: { slack: boolean; batch?: BatchFile; agent?: Proposal['agent'] }
): Promise<void> => {
  const proposals = new Map<string, Proposal>()
  for (const resolution of resolutions) {
    proposals.set(
      resolution.key,
      toProposal(resolution, docs.proposals[resolution.key], rightNow, {
        batchId: opts.batch?.batchId,
        instructionsVersion:
          opts.batch == null ? undefined : instructionsVersion,
        agent: opts.agent,
        appliedEntry:
          resolution.outcome.status === 'applied'
            ? toCrossChainEntry(resolution)
            : undefined
      })
    )
  }
  await saveProposals(proposals)
  const report = {
    resolved: resolutions.map(toLine),
    superseded: [],
    batch:
      opts.batch == null
        ? undefined
        : {
            batchId: opts.batch.batchId,
            assetCount: opts.batch.entries.length,
            verdictCount: opts.batch.entries.length
          }
  }
  const summary = agentSummary(report)
  const text = formatReport({
    day: rightNow.toISOString().slice(0, 10),
    selection: { entries: [], total: 0, ignored: 0 },
    sections: resolverReportSections(report),
    footer:
      summary == null
        ? ['Posted by yarn assetResolver']
        : [summary, 'Posted by yarn assetResolver']
  })
  if (text == null) return
  console.log(`\n${text}`)
  const webhookUrl =
    config.assetResolver.slackWebhookUrl !== ''
      ? config.assetResolver.slackWebhookUrl
      : config.slackWebhookUrl
  if (opts.slack && webhookUrl !== '') await postSlackText(webhookUrl, text)
}

const main = async (): Promise<void> => {
  const { command, positionals, flags } = parseCliArgs(process.argv.slice(2))
  const rightNow = new Date()
  const file = flagString(flags, 'file')

  switch (command) {
    case 'resolve': {
      const assets = await readAssets(positionals, file)
      const docs = await loadResolverDocs()
      const deps = await makeResolveDeps(docs, rightNow)
      let resolutions = await resolveAll(assets, docs, deps, {
        blind: flags.blind === true,
        forced: false
      })
      if (flags.agent === true)
        resolutions = (
          await runAgentFor(resolutions, deps, { forced: false, ingest: true })
        ).resolutions
      if (flags.json === true) {
        console.log(JSON.stringify(resolutions, null, 2))
      } else {
        for (const resolution of resolutions) printResolution(resolution)
      }
      return
    }
    case 'apply': {
      const assets = await readAssets(positionals, file)
      const docs = await loadResolverDocs()
      const deps = await makeResolveDeps(docs, rightNow)
      const forced = flags.force === true
      const scripted = await resolveAll(assets, docs, deps, {
        blind: false,
        forced
      })
      for (const resolution of scripted) await applyResolution(resolution)
      const {
        resolutions,
        batch,
        file: verdicts
      } = await runAgentFor(scripted, deps, { forced, ingest: true })
      for (const resolution of resolutions) printResolution(resolution)
      await recordAndReport(resolutions, docs, rightNow, {
        slack: flags['no-slack'] !== true,
        batch,
        agent: verdicts?.agent
      })
      return
    }
    case 'agent': {
      const docs = await loadResolverDocs()
      const deps = await makeResolveDeps(docs, rightNow)
      const batchId = flagString(flags, 'batch')
      if (batchId != null) {
        const { batch, dir } = await readBatch(batchId)
        console.log(`Re-running the agent on batch ${batchId} in ${dir}`)
        const verdicts = await runAgentOnBatch(batch, {
          dir,
          batchPath: path.join(dir, 'batch.json'),
          verdictsPath: path.join(dir, 'verdicts.json'),
          logPath: path.join(dir, 'agent.log')
        })
        if (flags['no-ingest'] === true) return
        const resolutions = await ingestVerdicts(batch, verdicts, deps, {
          appliesThisRun: 0
        })
        for (const resolution of resolutions) printResolution(resolution)
        await recordAndReport(resolutions, docs, rightNow, {
          slack: true,
          batch,
          agent: verdicts.agent
        })
        return
      }
      const assets = await readAssets(positionals, file)
      const scripted = await resolveAll(assets, docs, deps, {
        blind: false,
        forced: false
      })
      const {
        resolutions,
        batch,
        file: verdicts
      } = await runAgentFor(scripted, deps, {
        forced: false,
        ingest: flags['no-ingest'] !== true
      })
      for (const resolution of resolutions) printResolution(resolution)
      if (flags['no-ingest'] !== true)
        await recordAndReport(resolutions, docs, rightNow, {
          slack: true,
          batch,
          agent: verdicts?.agent
        })
      return
    }
    case 'export': {
      const out = flagString(flags, 'out')
      if (out == null) throw new Error('--out is required')
      const batchId = flagString(flags, 'batch')
      let batch: BatchFile
      if (batchId != null) {
        batch = (await readBatch(batchId)).batch
      } else {
        const assets = await readAssets(positionals, file)
        const docs = await loadResolverDocs()
        const deps = await makeResolveDeps(docs, rightNow)
        const resolutions = await resolveAll(assets, docs, deps, {
          blind: flags.blind === true,
          forced: false
        })
        batch = buildBatch(
          resolutions
            .filter(
              resolution => resolution.outcome.status === 'awaiting_agent'
            )
            .map(resolution => ({
              key: resolution.key,
              asset: resolution.asset,
              assetClass: resolution.assetClass,
              requestCount: resolution.requestCount,
              evidence: resolution.evidence,
              scamSignals: resolution.signals,
              candidates: resolution.candidates
            })),
          rightNow
        )
      }
      await writeFile(out, JSON.stringify(batch, null, 2))
      console.log(
        `Wrote ${String(batch.entries.length)} entries of batch ${
          batch.batchId
        } to ${out}`
      )
      return
    }
    case 'validate': {
      const [verdictsPath] = positionals
      if (verdictsPath == null) throw new Error('Give the verdicts file')
      const verdicts = asJSON(asVerdictsFile)(
        await readFile(verdictsPath, 'utf8')
      )
      console.log(
        `OK: ${String(verdicts.verdicts.length)} verdicts for batch ${
          verdicts.batchId
        } (instructions version ${String(verdicts.instructionsVersion)})`
      )
      return
    }
    case 'ingest': {
      const [verdictsPath] = positionals
      if (verdictsPath == null) throw new Error('Give the verdicts file')
      const text = await readFile(verdictsPath, 'utf8')
      const header = asJSON(asVerdictsFile)(text)
      const { batch } = await readBatch(header.batchId)
      const verdicts = parseVerdictsFile(text, {
        batchId: batch.batchId,
        instructionsVersion: batch.instructionsVersion,
        keys: batch.entries.map(entry => entry.key)
      })
      const docs = await loadResolverDocs()
      const deps = await makeResolveDeps(docs, rightNow)
      const resolutions = await ingestVerdicts(batch, verdicts, deps, {
        forced: flags.force === true,
        appliesThisRun: 0
      })
      for (const resolution of resolutions) printResolution(resolution)
      await recordAndReport(resolutions, docs, rightNow, {
        slack: true,
        batch,
        agent: verdicts.agent
      })
      return
    }
    case 'rollback': {
      const asset = positionalAsset(positionals)
      if (asset == null) throw new Error('Give <pluginId> [tokenId]')
      const key = toCryptoKey(asset)
      const removed = await removeCrossChainEntry(key)
      const docs = await loadResolverDocs()
      const prior = docs.proposals[key]
      if (prior != null) {
        await saveProposals(
          new Map([
            [
              key,
              {
                ...prior,
                status: 'rolled_back',
                rolledBackAt: rightNow.toISOString(),
                nextAttemptAfter: undefined
              }
            ]
          ])
        )
      }
      console.log(
        removed
          ? `Removed the crosschain:ai entry for ${key}`
          : `No crosschain:ai entry for ${key}`
      )
      return
    }
    case 'ignore': {
      const asset = positionalAsset(positionals)
      const reason = flagString(flags, 'reason')
      if (asset == null || reason == null)
        throw new Error('Give <pluginId> [tokenId] --reason "..."')
      await addIgnoreEntry(
        toCryptoKey(asset),
        reason,
        flagString(flags, 'until')
      )
      console.log(`Ignoring ${toCryptoKey(asset)}`)
      return
    }
    case 'unignore': {
      const asset = positionalAsset(positionals)
      if (asset == null) throw new Error('Give <pluginId> [tokenId]')
      const removed = await removeIgnoreEntry(toCryptoKey(asset))
      console.log(
        removed
          ? `No longer ignoring ${toCryptoKey(asset)}`
          : `${toCryptoKey(asset)} was not ignored`
      )
      return
    }
    case 'list': {
      if (flags.ignored === true) {
        const docs = await loadResolverDocs()
        for (const [key, entry] of Object.entries(docs.ignore)) {
          console.log(
            `${key}\t${entry.reason}${
              entry.until != null ? `\tuntil ${entry.until}` : ''
            }`
          )
        }
        return
      }
      if (flags.batches === true) {
        const batches = await readSettingsDoc(
          'assetResolver:batches',
          asBatchMap,
          {}
        )
        for (const [batchId, record] of Object.entries(batches)) {
          console.log(
            `${batchId}\t${record.status}\t${String(record.assetCount)} assets${
              record.verdictCount != null
                ? `, ${String(record.verdictCount)} verdicts`
                : ''
            }${record.error != null ? `\t${record.error}` : ''}`
          )
        }
        return
      }
      const status = flagString(flags, 'status')
      const proposals = await readSettingsDoc(
        'assetResolver:proposals',
        asProposalMap,
        {}
      )
      for (const [key, proposal] of Object.entries(proposals)) {
        if (status != null && proposal.status !== status) continue
        console.log(
          `${key}\t${proposal.status}\t${proposal.coingeckoId ?? ''}\t${
            proposal.confidence != null ? String(proposal.confidence) : ''
          }\t${proposal.destination?.key ?? ''}\t${proposal.lastAttempt}`
        )
      }
      return
    }
    case 'report': {
      const text = await runDailyReport(rightNow)
      if (text == null) console.log('Nothing to report')
      return
    }
    case 'calibrate': {
      const pairs = flagNumber(flags, 'pairs', 40)
      const seed = flagNumber(flags, 'seed', 1)
      const mode = flagString(flags, 'mode') ?? 'proof-only'
      const out = flagString(flags, 'out')
      const docs = await loadResolverDocs()
      const deps = await makeResolveDeps(docs, rightNow)
      const coingeckoDocs = {
        tokenTypes: docs.context.tokenTypes,
        platforms: docs.context.platforms
      }
      const coingecko = makeCoingeckoClient({
        uri: config.providers.coingeckopro.uri,
        apiKey: config.providers.coingeckopro.apiKey,
        fetchJson,
        spacingMs: config.assetResolver.research.coingeckoSpacingMs
      })
      const samples = await buildCalibrationSamples(
        coingecko,
        coingeckoDocs,
        deps.topCoins,
        { pairs, seed }
      )
      console.log(`Scoring ${String(samples.length)} samples (${mode})`)
      const resolutions = new Map<string, Resolution>()
      let scripted: Resolution[] = []
      for (const sample of samples) {
        const resolution = await resolveDeterministic(
          sample.asset,
          'unmapped-token',
          deps,
          { blind: true, appliesThisRun: 0, requestCount: 0 }
        )
        scripted.push(resolution)
      }
      if (mode === 'agent') {
        scripted = (
          await runAgentFor(
            scripted,
            {
              ...deps,
              config: {
                ...deps.config,
                autoApply: { ...deps.config.autoApply, enabled: false }
              }
            },
            { forced: false, ingest: true }
          )
        ).resolutions
      }
      for (const resolution of scripted)
        resolutions.set(resolution.key, resolution)
      const { rows, report } = scoreCalibration(samples, resolutions)
      console.log(JSON.stringify(report, null, 2))
      if (out != null) {
        await writeFile(out, JSON.stringify({ report, rows, samples }, null, 2))
        console.log(`Wrote ${out}`)
      }
      return
    }
    default:
      console.log(usage)
      if (command !== 'help') throw new Error(`Unknown command ${command}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
