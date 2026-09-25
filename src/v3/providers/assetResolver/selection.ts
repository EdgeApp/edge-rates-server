import type { ClassifierContext, UnresolvedAssetClass } from './classify'
import { isMappedNow } from './classify'
import type { ReportedAsset } from './report'
import type { Proposal, ProposalMap } from './types'

const researchable: UnresolvedAssetClass[] = [
  'unmapped-token',
  'unmapped-native'
]

/** Statuses a later run only rechecks cheaply, never re-researches. */
const settled = new Set<Proposal['status']>([
  'applied',
  'proposed',
  'needs_manual_mapping',
  'superseded',
  'rolled_back'
])

/**
 * The reported assets worth spending a research run on: resolvable classes,
 * enough requests, and no proposal that already settled them or asked to
 * wait.
 */
export const selectResearchCandidates = (
  entries: ReportedAsset[],
  proposals: ProposalMap,
  opts: { rightNow: Date; minRequestCount: number; maxAssetsPerRun: number }
): ReportedAsset[] => {
  const out: ReportedAsset[] = []
  for (const entry of entries) {
    if (!researchable.includes(entry.assetClass)) continue
    if (entry.count < opts.minRequestCount) continue
    const prior = proposals[entry.key]
    if (prior != null) {
      if (settled.has(prior.status)) continue
      if (
        prior.nextAttemptAfter != null &&
        new Date(prior.nextAttemptAfter) > opts.rightNow
      ) {
        continue
      }
    }
    out.push(entry)
    if (out.length >= opts.maxAssetsPerRun) break
  }
  return out
}

/**
 * Proposals whose asset a hand-edited or automated document now maps on its
 * own, so the resolver's opinion no longer matters. `context` must exclude
 * the `crosschain:ai` document, or applied entries would supersede themselves.
 */
export const findSuperseded = (
  proposals: ProposalMap,
  contextWithoutAi: ClassifierContext
): string[] =>
  Object.entries(proposals)
    .filter(
      ([key, proposal]) =>
        [
          'proposed',
          'applied',
          'needs_manual_mapping',
          'awaiting_agent'
        ].includes(proposal.status) && isMappedNow(contextWithoutAi, key)
    )
    .map(([key]) => key)
