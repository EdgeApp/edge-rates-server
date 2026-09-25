import type { ClassifierContext, UnresolvedAssetClass } from './classify'
import { classifyUnresolvedAsset, isIgnored } from './classify'
import type { IgnoreMap } from './types'

export interface ReportedAsset {
  key: string
  count: number
  assetClass: UnresolvedAssetClass
}

export interface ReportSelection {
  /** The assets to show, most requested first. */
  entries: ReportedAsset[]
  /** Every asset that was not ignored, shown or not. */
  total: number
  ignored: number
}

export interface ReportSection {
  title: string
  lines: string[]
}

export const selectReportedAssets = (
  counts: Map<string, number>,
  opts: {
    context: ClassifierContext
    ignore: IgnoreMap
    rightNow: Date
    topN: number
  }
): ReportSelection => {
  const entries: ReportedAsset[] = []
  let ignored = 0
  for (const [key, count] of counts) {
    if (isIgnored(opts.ignore[key], opts.rightNow)) {
      ignored++
      continue
    }
    entries.push({
      key,
      count,
      assetClass: classifyUnresolvedAsset(opts.context, key)
    })
  }
  entries.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count
    return a.key.localeCompare(b.key)
  })
  return {
    entries: entries.slice(0, opts.topN),
    total: entries.length,
    ignored
  }
}

const classSections: Array<{
  assetClass: UnresolvedAssetClass
  title: string
}> = [
  { assetClass: 'unmapped-token', title: 'UNMAPPED TOKENS' },
  { assetClass: 'unmapped-native', title: 'UNMAPPED NATIVE COINS' },
  {
    assetClass: 'mapped-unpriced',
    title: 'MAPPED BUT UNPRICED (a provider maps the asset but had no price)'
  },
  {
    assetClass: 'chain-tokens-unsupported',
    title:
      'CHAIN TOKENS UNSUPPORTED (set tokenTypes and coingecko:platforms for the chain)'
  },
  {
    assetClass: 'unknown-plugin',
    title:
      'UNKNOWN PLUGINS (testnets need a crosschain entry; new chains need tokenTypes, coingecko:platforms, and coingecko entries)'
  },
  {
    assetClass: 'v2-unknown-code',
    title: 'V2 UNKNOWN CODES (add them to v2CurrencyCodeMap)'
  }
]

/** One section per asset class, in a fixed order, empty classes omitted. */
export const classReportSections = (
  entries: ReportedAsset[]
): ReportSection[] =>
  classSections
    .map(({ assetClass, title }) => ({
      title,
      lines: entries
        .filter(entry => entry.assetClass === assetClass)
        .map(entry => `- ${entry.key} (${entry.count})`)
    }))
    .filter(section => section.lines.length > 0)

/** The daily Slack message, or undefined when there is nothing to report. */
export const formatReport = (opts: {
  day: string
  selection: ReportSelection
  sections: ReportSection[]
  footer: string[]
}): string | undefined => {
  const { day, selection, sections, footer } = opts
  if (selection.total === 0 && sections.length === 0) return

  const shown = selection.entries.length
  let header = `[asset-resolver] ${day}: ${selection.total} assets returned without a rate since the last report`
  if (shown < selection.total) header += ` (top ${shown} shown)`
  if (selection.ignored > 0) header += `; ${selection.ignored} ignored`

  const body = sections.map(
    section => `${section.title}\n${section.lines.join('\n')}`
  )
  return [header, ...body, ...footer].join('\n')
}

// Resolver outcomes

export interface ResolvedLine {
  key: string
  symbol?: string
  status: string
  coingeckoId?: string
  relationship?: string
  confidence?: number
  judge: string
  destinationKey?: string
  reasons: string[]
  signals: string[]
}

export interface ResolverReport {
  resolved: ResolvedLine[]
  superseded: string[]
  batch?: { batchId: string; assetCount: number; verdictCount?: number }
  agentError?: string
}

const withSymbol = (line: ResolvedLine): string =>
  line.symbol == null ? line.key : `${line.key} (${line.symbol})`

const mapping = (line: ResolvedLine): string =>
  `-> ${line.destinationKey ?? '?'} ${line.coingeckoId ?? '?'}, ${
    line.relationship ?? '?'
  }, ${String(line.confidence ?? '?')} ${line.judge}`

/** The report sections for what the resolver decided this run. */
export const resolverReportSections = (
  report: ResolverReport
): ReportSection[] => {
  const byStatus = (status: string): ResolvedLine[] =>
    report.resolved.filter(line => line.status === status)
  const sections: ReportSection[] = [
    {
      title: 'APPLIED',
      lines: byStatus('applied').map(
        line => `- ${withSymbol(line)} ${mapping(line)}`
      )
    },
    {
      title: 'PROPOSED (needs review)',
      lines: byStatus('proposed').map(
        line =>
          `- ${withSymbol(line)} ${mapping(
            line
          )} | not applied: ${line.reasons.join(', ')}`
      )
    },
    {
      title: 'SUSPECTED SCAM (not priced)',
      lines: byStatus('suspected_scam').map(
        line => `- ${withSymbol(line)} | ${line.signals.join(', ')}`
      )
    },
    {
      title: 'NEEDS MANUAL MAPPING',
      lines: byStatus('needs_manual_mapping').map(
        line =>
          `- ${withSymbol(line)} | coingecko "${
            line.coingeckoId ?? '?'
          }" is not priced on any Edge chain; add "${line.key}": { "id": "${
            line.coingeckoId ?? '?'
          }", "displayName": "${
            line.symbol ?? line.coingeckoId ?? '?'
          }" } to rates_settings/coingecko`
      )
    },
    {
      title: 'NOT RESOLVED (rechecked later)',
      lines: report.resolved
        .filter(line =>
          [
            'distinct_asset',
            'not_found',
            'unsure',
            'error',
            'awaiting_agent'
          ].includes(line.status)
        )
        .map(
          line =>
            `- ${withSymbol(line)} | ${line.status}: ${line.reasons.join('; ')}`
        )
    },
    {
      title: 'SUPERSEDED (now mapped by another document)',
      lines: report.superseded.map(key => `- ${key}`)
    }
  ]
  if (report.agentError != null) {
    sections.push({
      title: 'AGENT ERROR',
      lines: [`- batch ${report.batch?.batchId ?? '?'}: ${report.agentError}`]
    })
  }
  return sections.filter(section => section.lines.length > 0)
}

export const agentSummary = (report: ResolverReport): string | undefined => {
  if (report.batch == null) return
  const { batchId, assetCount, verdictCount } = report.batch
  return `agent batch ${batchId}: ${String(assetCount)} assets, ${
    verdictCount == null ? 'no verdicts' : `${String(verdictCount)} verdicts`
  }`
}
