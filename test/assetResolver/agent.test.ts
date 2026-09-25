import { assert } from 'chai'
import * as fsPromises from 'fs/promises'
import { access, mkdtemp, readFile } from 'fs/promises'
import { describe, it } from 'mocha'
import { tmpdir } from 'os'
import path from 'path'

import {
  prepareRunDir,
  readVerdictsText,
  runAgent
} from '../../src/v3/providers/assetResolver/agent'
import {
  type BatchEntry,
  buildBatch,
  instructionsVersion,
  parseVerdictsFile
} from '../../src/v3/providers/assetResolver/batch'
import { makeEvidence } from './helpers'

// The repo's @types/node predates fs.promises.rm; Node 24 has it.
const { rm } = fsPromises as unknown as {
  rm: (
    dir: string,
    opts: { recursive: boolean; force: boolean }
  ) => Promise<void>
}
const fakeAgent = path.join(__dirname, 'fixtures', 'fakeAgent.sh')
const entry: BatchEntry = {
  key: 'polygon_2791bca1f2de4661ed88a30c99a7a9449aa84174',
  asset: {
    pluginId: 'polygon',
    tokenId: '2791bca1f2de4661ed88a30c99a7a9449aa84174'
  },
  assetClass: 'unmapped-token',
  requestCount: 3,
  evidence: makeEvidence(),
  scamSignals: [],
  candidates: []
}

describe('agent runner', function () {
  this.timeout(15000)

  it('lays out a run directory and turns the agent output into verdicts', async function () {
    const runRoot = await mkdtemp(path.join(tmpdir(), 'asset-resolver-'))
    try {
      const batch = buildBatch([entry], new Date('2026-09-25T16:05:00.000Z'))
      const runDir = await prepareRunDir(runRoot, batch)
      assert.equal(path.basename(runDir.dir), '2026-09-25-16-05-00')
      for (const name of [
        'batch.json',
        'INSTRUCTIONS.md',
        'AGENTS.md',
        'verdicts.schema.json'
      ]) {
        await access(path.join(runDir.dir, name))
      }
      assert.isUndefined(await readVerdictsText(runDir.verdictsPath))

      const result = await runAgent({
        runDir: runDir.dir,
        command: fakeAgent,
        apiKey: 'secret',
        timeoutSeconds: 10
      })
      assert.equal(result.exitCode, 0)
      assert.isFalse(result.timedOut)

      const text = await readVerdictsText(runDir.verdictsPath)
      const file = parseVerdictsFile(text ?? '', {
        batchId: batch.batchId,
        instructionsVersion,
        keys: [entry.key]
      })
      assert.equal(file.agent?.name, 'fake-agent')
      assert.equal(file.verdicts[0].decision, 'not_found')

      const log = await readFile(runDir.logPath, 'utf8')
      assert.include(log, 'fake agent in')
      assert.include(log, 'with key secret')
      assert.include(log, 'exit 0')
    } finally {
      await rm(runRoot, { recursive: true, force: true })
    }
  })

  it('kills the agent when the timeout passes', async function () {
    const runRoot = await mkdtemp(path.join(tmpdir(), 'asset-resolver-'))
    try {
      const runDir = await prepareRunDir(
        runRoot,
        buildBatch([entry], new Date())
      )
      const result = await runAgent({
        runDir: runDir.dir,
        command: fakeAgent,
        apiKey: 'x',
        timeoutSeconds: 1,
        prompt: 'sleep'
      })
      assert.isTrue(result.timedOut)
      assert.isUndefined(await readVerdictsText(runDir.verdictsPath))
    } finally {
      await rm(runRoot, { recursive: true, force: true })
    }
  })

  it('rejects when the agent command is missing', async function () {
    const runRoot = await mkdtemp(path.join(tmpdir(), 'asset-resolver-'))
    try {
      const runDir = await prepareRunDir(
        runRoot,
        buildBatch([entry], new Date())
      )
      let failed = false
      try {
        await runAgent({
          runDir: runDir.dir,
          command: 'definitely-not-an-agent-binary',
          apiKey: 'x',
          timeoutSeconds: 5
        })
      } catch (error: unknown) {
        failed = true
      }
      assert.isTrue(failed)
    } finally {
      await rm(runRoot, { recursive: true, force: true })
    }
  })
})
