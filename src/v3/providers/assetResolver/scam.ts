import type { AssetEvidence, SearchHit } from './evidence/types'

export type SignalStrength = 'strong' | 'weak'

export interface ScamSignal {
  name: string
  strength: SignalStrength
  detail: string
}

export interface ScamConfig {
  minLiquidityUsd: number
  minHolders: number
  /** A fraction: 0.2 means a 20% sell tax. */
  maxSellTax: number
  rugcheckMaxScore: number
  /** How far down the market-cap ranking impersonation checks reach. */
  topCoinRank: number
}

const flag = (value: string | undefined): boolean => value === '1'

const toNumber = (value: string | undefined): number | undefined => {
  if (value == null || value === '') return
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

/** The symbols and names the sources report for the asset itself. */
export const ownIdentity = (
  evidence: AssetEvidence
): { symbols: string[]; names: string[] } => {
  const symbols = new Set<string>()
  const names = new Set<string>()
  const add = (set: Set<string>, value: string | undefined): void => {
    if (value != null && value !== '') set.add(value.toLowerCase())
  }
  add(symbols, evidence.defiLlama?.symbol)
  add(symbols, evidence.goplus?.token_symbol)
  add(symbols, evidence.jupiter?.symbol)
  add(symbols, evidence.chainRegistry?.symbol)
  add(names, evidence.goplus?.token_name)
  add(names, evidence.jupiter?.name)
  add(names, evidence.chainRegistry?.name)
  for (const hit of evidence.tokenLists) {
    add(symbols, hit.symbol)
    add(names, hit.name)
  }
  return { symbols: Array.from(symbols), names: Array.from(names) }
}

/**
 * Whether a trusted source ties this exact address to a coin: the issuer
 * registry, CoinGecko's listing on this chain, or an official bridge list.
 */
export const hasTrustedListing = (evidence: AssetEvidence): boolean =>
  evidence.issuerRegistry != null ||
  evidence.coingecko.contract != null ||
  evidence.coingecko.addressIndex.some(
    hit => hit.pluginId === evidence.chain.pluginId
  ) ||
  evidence.tokenLists.some(hit => hit.bridgeInfo.length > 0)

/**
 * Deterministic scam signals. A strong signal keeps the asset from ever
 * being priced by the resolver; weak signals block auto-apply and are
 * shown for review.
 */
export const detectScamSignals = (
  evidence: AssetEvidence,
  topCoins: SearchHit[],
  config: ScamConfig
): ScamSignal[] => {
  const signals: ScamSignal[] = []
  const { goplus, rugcheck, jupiter, defiLlama, etherscan } = evidence

  // Impersonation: looks like a top coin, but nothing trusted lists it
  if (!hasTrustedListing(evidence)) {
    const { symbols, names } = ownIdentity(evidence)
    const lookalike = topCoins.find(
      coin =>
        coin.marketCapRank != null &&
        coin.marketCapRank <= config.topCoinRank &&
        (symbols.includes(coin.symbol.toLowerCase()) ||
          names.includes(coin.name.toLowerCase()))
    )
    if (lookalike != null) {
      signals.push({
        name: 'impersonation',
        strength: 'strong',
        detail: `symbol or name matches ${lookalike.id} (rank ${String(
          lookalike.marketCapRank
        )}) but no trusted source lists this address`
      })
    }
  }

  if (goplus != null) {
    const strongFlags: Array<[string, boolean]> = [
      ['is_honeypot', flag(goplus.is_honeypot)],
      ['fake_token', goplus.fake_token?.value === 1],
      ['is_airdrop_scam', flag(goplus.is_airdrop_scam)],
      ['cannot_sell_all', flag(goplus.cannot_sell_all)],
      ['hidden_owner', flag(goplus.hidden_owner)],
      ['owner_change_balance', flag(goplus.owner_change_balance)]
    ]
    for (const [name, raised] of strongFlags) {
      if (raised) {
        signals.push({
          name,
          strength: 'strong',
          detail: `GoPlus reports ${name}`
        })
      }
    }
    const sellTax = toNumber(goplus.sell_tax)
    if (sellTax != null && sellTax > config.maxSellTax) {
      signals.push({
        name: 'sell_tax',
        strength: 'strong',
        detail: `GoPlus reports a ${String(sellTax * 100)}% sell tax`
      })
    }

    const liquidity = goplus.dex.reduce(
      (sum, dex) => sum + (toNumber(dex.liquidity) ?? 0),
      0
    )
    if (goplus.is_in_dex === '0' || liquidity < config.minLiquidityUsd) {
      signals.push({
        name: 'no_liquidity',
        strength: 'weak',
        detail: `GoPlus sees $${String(Math.round(liquidity))} of DEX liquidity`
      })
    }
    const holders = toNumber(goplus.holder_count)
    if (holders != null && holders < config.minHolders) {
      signals.push({
        name: 'low_holders',
        strength: 'weak',
        detail: `GoPlus counts ${String(holders)} holders`
      })
    }
    if (goplus.is_open_source === '0') {
      signals.push({
        name: 'unverified_contract',
        strength: 'weak',
        detail: 'GoPlus reports the contract source is not open'
      })
    }
  }

  if (etherscan != null && !etherscan.verified) {
    signals.push({
      name: 'unverified_contract',
      strength: 'weak',
      detail: 'Etherscan has no verified source for the contract'
    })
  }

  if (rugcheck != null) {
    const dangers = rugcheck.risks.filter(risk => risk.level === 'danger')
    if (dangers.length > 0) {
      signals.push({
        name: 'rugcheck_danger',
        strength: 'strong',
        detail: `RugCheck flags ${dangers.map(risk => risk.name).join(', ')}`
      })
    }
    if (
      rugcheck.score_normalised != null &&
      rugcheck.score_normalised > config.rugcheckMaxScore
    ) {
      signals.push({
        name: 'rugcheck_score',
        strength: 'strong',
        detail: `RugCheck risk score ${String(rugcheck.score_normalised)}`
      })
    }
  }

  if (jupiter != null) {
    const verified =
      jupiter.isVerified === true ||
      jupiter.tags.some(tag =>
        ['verified', 'strict', 'community'].includes(tag)
      )
    if (!verified) {
      signals.push({
        name: 'unverified_solana',
        strength: 'weak',
        detail: 'Jupiter has not verified this mint'
      })
    }
    if (
      jupiter.liquidity != null &&
      jupiter.liquidity < config.minLiquidityUsd
    ) {
      signals.push({
        name: 'no_liquidity',
        strength: 'weak',
        detail: `Jupiter sees $${String(
          Math.round(jupiter.liquidity)
        )} of liquidity`
      })
    }
    if (
      jupiter.holderCount != null &&
      jupiter.holderCount < config.minHolders
    ) {
      signals.push({
        name: 'low_holders',
        strength: 'weak',
        detail: `Jupiter counts ${String(jupiter.holderCount)} holders`
      })
    }
  }

  if (defiLlama?.confidence != null && defiLlama.confidence < 0.9) {
    signals.push({
      name: 'low_price_confidence',
      strength: 'weak',
      detail: `DefiLlama prices it with confidence ${String(
        defiLlama.confidence
      )}`
    })
  }

  const footprint =
    evidence.coingecko.contract != null ||
    evidence.coingecko.addressIndex.length > 0 ||
    evidence.defiLlama != null ||
    evidence.tokenLists.length > 0 ||
    evidence.chainRegistry != null ||
    evidence.jupiter != null ||
    evidence.issuerRegistry != null
  if (!footprint && evidence.address != null) {
    signals.push({
      name: 'no_footprint',
      strength: 'weak',
      detail:
        'No price source, token list, registry, or CoinGecko listing knows this address'
    })
  }

  return signals
}

export const hasStrongSignal = (signals: ScamSignal[]): boolean =>
  signals.some(signal => signal.strength === 'strong')
