#!/usr/bin/env bash
# A stand-in for the Cursor CLI: answers every batch entry with "not_found",
# or sleeps when the prompt is "sleep", so the runner can be tested.
set -euo pipefail
workspace=""
prompt=""
while [ $# -gt 0 ]; do
  case "$1" in
    --workspace) workspace="$2"; shift 2 ;;
    -p) prompt="$2"; shift 2 ;;
    *) shift ;;
  esac
done
if [ "$prompt" = "sleep" ]; then
  sleep 5
fi
echo "fake agent in $workspace with key ${CURSOR_API_KEY:-none}"
node -e '
const fs = require("fs")
const path = require("path")
const dir = process.argv[1]
const batch = JSON.parse(fs.readFileSync(path.join(dir, "batch.json"), "utf8"))
const verdicts = batch.entries.map(entry => ({
  key: entry.key,
  decision: "not_found",
  coingeckoId: null,
  relationship: null,
  confidence: 0.4,
  issuer: null,
  rationale: "Fake agent: nothing checked.",
  evidence: [],
  scamIndicators: []
}))
fs.writeFileSync(path.join(dir, "verdicts.json"), JSON.stringify({
  batchId: batch.batchId,
  instructionsVersion: batch.instructionsVersion,
  agent: { name: "fake-agent" },
  verdicts
}, null, 2))
' "$workspace"
