import type { BatchCandidate } from './batch'
import type { AssetEvidence } from './evidence/types'
import type { ProvenanceProof } from './provenance'
import type { ScamSignal } from './scam'
import type { Verdict } from './types'

export interface JudgeInput {
  evidence: AssetEvidence
  signals: ScamSignal[]
  proof?: ProvenanceProof
  verdict?: Verdict
  /** The coin the proof or verdict claims the asset to be. */
  candidate?: BatchCandidate
}

const clip = (text: string | undefined, max: number): string => {
  if (text == null) return ''
  return text.length > max ? `${text.slice(0, max)}...` : text
}

/**
 * A bounded, deterministic text of the evidence and the claim, for a judge
 * that scores "is this the same asset" from text alone.
 */
export const renderJudgeState = (input: JudgeInput): string => {
  const { evidence, signals, proof, verdict, candidate } = input
  const lines: string[] = []
  lines.push(`Asset: ${evidence.key} on ${evidence.chain.pluginId}`)
  if (evidence.address != null) lines.push(`Address: ${evidence.address}`)
  if (evidence.defiLlama != null) {
    lines.push(
      `DefiLlama: symbol ${evidence.defiLlama.symbol}, price ${String(
        evidence.defiLlama.price
      )}, confidence ${String(evidence.defiLlama.confidence ?? 'unknown')}`
    )
  }
  for (const hit of evidence.tokenLists.slice(0, 3)) {
    const origins = hit.bridgeInfo
      .map(origin => `${String(origin.chainId)}:${origin.tokenAddress}`)
      .join(', ')
    lines.push(
      `Token list ${hit.list}: ${hit.symbol} (${clip(
        hit.name,
        60
      )}) bridged from ${origins === '' ? 'nothing' : origins}`
    )
  }
  if (evidence.chainRegistry != null) {
    lines.push(
      `Chain registry: ${evidence.chainRegistry.symbol ?? '?'} coingecko ${
        evidence.chainRegistry.coingeckoId ?? 'none'
      }`
    )
  }
  if (evidence.jupiter != null) {
    lines.push(
      `Jupiter: ${evidence.jupiter.symbol} verified ${String(
        evidence.jupiter.isVerified ?? false
      )} tags ${evidence.jupiter.tags.join(',')}`
    )
  }
  if (evidence.issuerRegistry != null) {
    lines.push(
      `Issuer registry: ${evidence.issuerRegistry.issuer} ${evidence.issuerRegistry.relationship} of ${evidence.issuerRegistry.coingeckoId}`
    )
  }
  if (evidence.goplus != null) {
    const { goplus } = evidence
    lines.push(
      `GoPlus: honeypot ${goplus.is_honeypot ?? '?'}, open source ${
        goplus.is_open_source ?? '?'
      }, holders ${goplus.holder_count ?? '?'}, in dex ${
        goplus.is_in_dex ?? '?'
      }, sell tax ${goplus.sell_tax ?? '?'}`
    )
  }
  if (evidence.rugcheck != null) {
    lines.push(
      `RugCheck: score ${String(
        evidence.rugcheck.score_normalised ?? '?'
      )}, risks ${evidence.rugcheck.risks.map(risk => risk.name).join('; ')}`
    )
  }
  lines.push(
    signals.length === 0
      ? 'Scam signals: none'
      : `Scam signals: ${signals
          .map(signal => `${signal.name} (${signal.strength})`)
          .join(', ')}`
  )
  if (candidate != null) {
    lines.push(
      `Claimed coin: ${candidate.id} (${candidate.symbol}, ${clip(
        candidate.name,
        60
      )}), rank ${String(candidate.marketCapRank ?? 'none')}, homepage ${
        candidate.homepage[0] ?? 'none'
      }, categories ${candidate.categories
        .slice(0, 4)
        .join(', ')}, listed on ${String(
        Object.keys(candidate.platforms).length
      )} platforms`
    )
    if (candidate.destination != null) {
      lines.push(
        `Edge destination: ${candidate.destination.key} at ${String(
          candidate.destination.usdRate ?? 'unpriced'
        )} USD, price delta ${String(candidate.priceDelta ?? 'unknown')}`
      )
    }
  }
  if (proof != null) {
    lines.push(
      `Scripted proof: ${proof.kind}, ${proof.relationship}, ${clip(
        proof.detail,
        200
      )}`
    )
  }
  if (verdict != null) {
    lines.push(
      `Agent verdict: ${verdict.decision}${
        verdict.coingeckoId != null ? ` as ${verdict.coingeckoId}` : ''
      }${
        verdict.relationship != null ? ` (${verdict.relationship})` : ''
      }, confidence ${String(verdict.confidence)}`
    )
    lines.push(`Rationale: ${clip(verdict.rationale, 400)}`)
    for (const item of verdict.evidence.slice(0, 8)) {
      lines.push(
        `Evidence (${item.supports}${item.primary ? ', primary' : ''}): ${clip(
          item.claim,
          200
        )}${item.url != null ? ` ${item.url}` : ''}`
      )
    }
    if (verdict.scamIndicators.length > 0) {
      lines.push(`Agent scam indicators: ${verdict.scamIndicators.join('; ')}`)
    }
  }
  return lines.join('\n')
}
