import { asNumber, asObject, asOptional, asString, asUnknown } from 'cleaners'

import { snooze } from '../../../utils/utils'
import type { FetchJson } from './evidence/types'
import { type JudgeInput, renderJudgeState } from './judgeState'

export type JudgeKind = 'proof' | 'agent' | 'jev'

export interface JudgeVerdict {
  kind: JudgeKind
  model: string
  /** Probability that the asset is the claimed coin. */
  probability: number
}

export interface Judge {
  kind: JudgeKind
  /** Undefined when this judge has nothing to say about the input. */
  judge: (input: JudgeInput) => Promise<JudgeVerdict | undefined>
}

/** The fixed confidence of a scripted provenance proof. */
export const proofJudge: Judge = {
  kind: 'proof',
  judge: async ({ proof }) =>
    proof == null
      ? undefined
      : { kind: 'proof', model: proof.kind, probability: proof.confidence }
}

/** The agent's own confidence in its verdict. */
export const agentJudge: Judge = {
  kind: 'agent',
  judge: async ({ verdict }) =>
    verdict == null
      ? undefined
      : { kind: 'agent', model: 'agent', probability: verdict.confidence }
}

const jevInstructions =
  "Is the asset the same asset, for pricing purposes, as the claimed coin? Same means the issuer's own deployment on another chain or the chain's canonical bridge representation, redeemable one for one. A shared ticker or name is not enough. Any sign of impersonation or a scam means no."

const asJevResponse = asObject({
  model: asString,
  answers: asObject({
    sameAsset: asObject({
      noul: asNumber
    })
  }),
  usage: asOptional(asUnknown)
})

/**
 * Jev, TypeSafe AI's decision model: one yes/no question over the rendered
 * evidence, answered with a calibrated probability.
 */
export const makeJevJudge = (opts: {
  fetchJson: FetchJson
  apiKey: string
  model: string
}): Judge => ({
  kind: 'jev',
  judge: async input => {
    if (input.proof == null && input.verdict == null) return
    const body = {
      model: opts.model,
      state: renderJudgeState(input),
      questions: {
        sameAsset: {
          type: 'noul',
          instructions: jevInstructions,
          criteria: {
            true: 'The asset is the claimed coin: same issuer, or the canonical bridge of it, backed by primary sources.',
            false:
              'The asset is a different coin, a third-party bridge, a wrapped or staked variant, an impersonation, or unproven.'
          }
        }
      }
    }
    let attempt = 0
    while (true) {
      const { status, body: reply } = await opts.fetchJson(
        'https://api.typesafe.ai/v1/systemone',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${opts.apiKey}`
          },
          body: JSON.stringify(body)
        }
      )
      if (status === 200) {
        const parsed = asJevResponse(reply)
        return {
          kind: 'jev',
          model: parsed.model,
          probability: parsed.answers.sameAsset.noul
        }
      }
      attempt++
      if ((status === 429 || status >= 500) && attempt <= 2) {
        await snooze(1000 * attempt)
        continue
      }
      throw new Error(`Jev replied ${status}`)
    }
  }
})

export const selectJudge = (
  kind: JudgeKind,
  opts: { fetchJson: FetchJson; typesafeApiKey: string; jevModel: string }
): Judge => {
  if (kind === 'jev') {
    if (opts.typesafeApiKey === '') {
      throw new Error('judge.kind is jev but TYPESAFE_API_KEY is not set')
    }
    return makeJevJudge({
      fetchJson: opts.fetchJson,
      apiKey: opts.typesafeApiKey,
      model: opts.jevModel
    })
  }
  return kind === 'proof' ? proofJudge : agentJudge
}
