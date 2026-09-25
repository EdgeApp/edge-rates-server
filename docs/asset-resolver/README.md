# Asset resolver

The asset resolver watches which `{ pluginId, tokenId }` combinations `/v3/rates` returns without a rate, researches them with scripted sources, hands whatever those sources cannot settle to an agent driven by `INSTRUCTIONS.md`, and reports everything to Slack once a day. Mappings that pass every guard land in the `crosschain:ai` document, which the router merges beneath the hand-edited `crosschain` document.

## Switching it on

The feature runs on exactly one box: the one whose config holds a Cursor API key. Set `CURSOR_API_KEY` in the pm2 environment (or `assetResolver.cursorApiKey` in `serverConfig.json`) on that box, install the Cursor CLI there (`curl https://cursor.com/install -fsS | bash`), and restart both `ratesServer` and `ratesEngines`. Every other box stays inert. `yarn setup` seeds the documents.

Optional keys: `ASSET_RESOLVER_SLACK_WEBHOOK_URL` for a dedicated channel, `ETHERSCAN_API_KEY` for verified-source checks, `GOPLUS_API_KEY` for higher GoPlus limits, `TYPESAFE_API_KEY` to use Jev as the judge (`assetResolver.judge.kind: "jev"`).

## What happens each day

1. The API records every combination that leaves `ratesV3` without a rate in the Redis set `assetResolver:unresolved`.
2. After 16:00 UTC the engine drains the set, reads the mapping documents fresh, and classifies each asset: mapped but unpriced, unknown plugin, chain without token support, unmapped native coin, unmapped token, or a v2 currency code the converter fabricated.
3. Unmapped tokens and natives with enough requests get the scripted pass: CoinGecko, DefiLlama, official token lists, the cosmos chain registry, Jupiter, GoPlus, RugCheck, Etherscan, and `data/issuerRegistry.json`. Provenance proofs (issuer registry, canonical bridge lists, CoinGecko listings, chain registry) settle identities with fixed confidences; strong scam signals settle the rest as `suspected_scam`.
4. Whatever remains goes to the agent as one batch under `assetResolver.agent.runRoot`, with `INSTRUCTIONS.md`, `AGENTS.md`, and the schema. The Cursor CLI runs headless there with only its API key in the environment and writes `verdicts.json`, which is validated before use.
5. Every outcome is recorded in `assetResolver:proposals`. A mapping is applied only when a scripted proof exists, no scam signal fired, the destination prices, prices agree, the confidence clears `autoApply.minConfidence`, and `autoApply.enabled` is on. Agent verdicts without a scripted proof become proposals for a human.
6. One Slack message lists applied, proposed, suspected scam, manual-mapping, unresolved, superseded, and chain-level items, with the CLI command for each action.

## Documents in `rates_settings`

| Document | Written by | Purpose |
|---|---|---|
| `assetResolver` | you | Ignore list: `"pluginId_tokenId": { "reason": "...", "until": "YYYY-MM-DD" }`; omit `until` to ignore forever. An unparseable `until` silences nothing. |
| `assetResolver:proposals` | resolver | Every asset it looked at: status, claim, confidence, judge, proof, signals, guards, verdict, attempts, recheck time. |
| `assetResolver:batches` | resolver | Agent batches and how they ended. |
| `crosschain:ai` | resolver | Applied cross-chain entries. Delete a key to roll it back; the hand-edited `crosschain` document always wins. |

Statuses: `applied`, `proposed`, `suspected_scam` (rechecked after `scamRecheckDays`), `needs_manual_mapping` (the coin is not priced on any Edge chain; add a `coingecko` entry), `awaiting_agent`, `distinct_asset`, `not_found`, `unsure`, `error` (rechecked on a doubling backoff), `superseded` (another document now maps it), `rolled_back`.

## CLI

Run `yarn assetResolver help` for every command. The common ones:

```
yarn assetResolver resolve polygon 2791bca1f2de4661ed88a30c99a7a9449aa84174 --blind
yarn assetResolver apply --file new-tokens.json
yarn assetResolver apply arbitrum af88d065e77c8cc2239327c5edb3a432268e5831 --force
yarn assetResolver rollback polygon 2791bca1f2de4661ed88a30c99a7a9449aa84174
yarn assetResolver ignore ufo --reason "no market" --until 2027-01-01
yarn assetResolver agent --batch 2026-09-25-16-00-00
yarn assetResolver export --file assets.json --out batch.json
yarn assetResolver ingest verdicts.json
yarn assetResolver report
yarn assetResolver calibrate --mode proof-only --pairs 200
```

`--blind` hides CoinGecko's own listing of the address so an already-mapped asset behaves like an unresolved one. `--force` waives the soft guards (confidence, relationship, run cap, weak signals, the deterministic-proof requirement, auto-apply being off) and never the hard ones (destination priced, still unresolved, no hand-edited entry, no strong scam signal). `apply --file` is the way to prefill mappings for tokens about to ship.

## Other agents

Any agent can run the protocol by hand: `export` a batch, point the agent at the run directory (`INSTRUCTIONS.md` explains the job), and `ingest` the `verdicts.json` it writes. `validate` checks a file against the schema first.

## Calibration

`calibrate` builds labelled pairs from CoinGecko's own multi-chain listings (positives: a coin's secondary deployments; negatives: coins sharing a top coin's symbol under another id), runs the resolver blind, and prints precision per confidence threshold, a Brier score, and reliability buckets. Treat the result as optimistic, keep `autoApply.maxPerRun` small at first, and re-run it after changing `INSTRUCTIONS.md` or the agent model.
