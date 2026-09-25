/** Flags that take a value; every other `--flag` is a switch. */
const valued = new Set([
  'file',
  'out',
  'batch',
  'model',
  'reason',
  'until',
  'status',
  'pairs',
  'mode',
  'seed'
])

export interface CliArgs {
  command: string
  positionals: string[]
  flags: Record<string, string | true>
}

export const parseCliArgs = (argv: string[]): CliArgs => {
  const [command = 'help', ...rest] = argv
  const positionals: string[] = []
  const flags: Record<string, string | true> = {}
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }
    const name = token.slice(2)
    const inline = name.indexOf('=')
    if (inline >= 0) {
      flags[name.slice(0, inline)] = name.slice(inline + 1)
      continue
    }
    if (valued.has(name)) {
      const value = rest[i + 1]
      if (value == null || value.startsWith('--')) {
        throw new Error(`--${name} needs a value`)
      }
      flags[name] = value
      i++
    } else {
      flags[name] = true
    }
  }
  return { command, positionals, flags }
}

export const flagString = (
  flags: CliArgs['flags'],
  name: string
): string | undefined => {
  const value = flags[name]
  return typeof value === 'string' ? value : undefined
}

export const flagNumber = (
  flags: CliArgs['flags'],
  name: string,
  fallback: number
): number => {
  const value = flagString(flags, name)
  if (value == null) return fallback
  const parsed = Number(value)
  if (Number.isNaN(parsed)) throw new Error(`--${name} must be a number`)
  return parsed
}

/** `<pluginId> [tokenId]` positionals as an asset, or undefined. */
export const positionalAsset = (
  positionals: string[]
): { pluginId: string; tokenId: string | null } | undefined => {
  const [pluginId, tokenId] = positionals
  if (pluginId == null) return
  return { pluginId, tokenId: tokenId ?? null }
}

export const usage = `Usage: yarn assetResolver <command> [options]

  resolve <pluginId> [tokenId] | --file assets.json [--blind] [--agent] [--json]
      Dry run: evidence, scam signals, proof, candidates, guards, decision.
  apply <pluginId> [tokenId] | --file assets.json [--force] [--no-slack]
      Resolve, run the agent on the residue, apply what passes, record, post.
  agent --batch <id> | --file assets.json [--model id] [--no-ingest]
      Run the agent on an existing batch or a fresh one, then ingest.
  export --batch <id> | --file assets.json --out batch.json
      Write a batch for any agent to process by hand.
  ingest <verdicts.json> [--force]
      Decide, record, and apply the verdicts of a batch under the run root.
  validate <verdicts.json>
      Check a verdicts file against the schema.
  rollback <pluginId> [tokenId]
      Remove an applied AI cross-chain entry.
  ignore <pluginId> [tokenId] --reason "..." [--until YYYY-MM-DD]
  unignore <pluginId> [tokenId]
  list [--status <status>] [--ignored] [--batches]
  report
      Run the daily drain, research, and Slack report once.
  calibrate [--pairs N] [--mode proof-only|agent] [--seed S] [--out file]
      Score the resolver against CoinGecko's own multi-chain listings.

assets.json is a JSON array of { "pluginId": "...", "tokenId": "..." | null }.
`
