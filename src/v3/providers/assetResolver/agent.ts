import { spawn } from 'child_process'
import { copyFile, mkdir, open, readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'

import type { BatchFile } from './batch'

/** The committed instructions, rules, and schemas the agent reads. */
export const assetResolverDocsDir = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'docs',
  'asset-resolver'
)

export const defaultAgentPrompt =
  'Read INSTRUCTIONS.md and process batch.json; write verdicts.json'

export interface RunDir {
  dir: string
  batchPath: string
  verdictsPath: string
  logPath: string
}

export const expandHome = (dir: string): string =>
  dir.startsWith('~/') ? path.join(homedir(), dir.slice(2)) : dir

/** Lays out one batch for the agent: batch, instructions, rules, schema. */
export const prepareRunDir = async (
  runRoot: string,
  batch: BatchFile,
  docsDir: string = assetResolverDocsDir
): Promise<RunDir> => {
  const dir = path.join(expandHome(runRoot), batch.batchId)
  await mkdir(dir, { recursive: true })
  const batchPath = path.join(dir, 'batch.json')
  await writeFile(batchPath, JSON.stringify(batch, null, 2))
  for (const name of ['INSTRUCTIONS.md', 'AGENTS.md', 'verdicts.schema.json']) {
    await copyFile(path.join(docsDir, name), path.join(dir, name))
  }
  return {
    dir,
    batchPath,
    verdictsPath: path.join(dir, 'verdicts.json'),
    logPath: path.join(dir, 'agent.log')
  }
}

export interface AgentRunOptions {
  runDir: string
  /** The Cursor CLI binary, or another agent that takes the same flags. */
  command: string
  model?: string
  apiKey: string
  timeoutSeconds: number
  prompt?: string
}

export interface AgentRunResult {
  exitCode: number | null
  timedOut: boolean
  durationMs: number
}

/**
 * Runs the agent headless in the run directory with a minimal environment
 * (no CouchDB credentials, no provider keys), logging its output beside the
 * batch and killing it when the timeout passes.
 */
export const runAgent = async (
  opts: AgentRunOptions
): Promise<AgentRunResult> => {
  const { runDir, command, model, apiKey, timeoutSeconds } = opts
  const prompt = opts.prompt ?? defaultAgentPrompt
  const args = [
    '-p',
    prompt,
    '--force',
    '--workspace',
    runDir,
    '--output-format',
    'json'
  ]
  if (model != null && model !== '') args.push('--model', model)

  const log = await open(path.join(runDir, 'agent.log'), 'a')
  const started = Date.now()
  await log.write(
    `[${new Date(started).toISOString()}] ${command} ${args.join(' ')}\n`
  )

  return await new Promise<AgentRunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: runDir,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? homedir(),
        CURSOR_API_KEY: apiKey
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutSeconds * 1000)

    const pipe = (chunk: Buffer): void => {
      log.write(chunk).catch(() => {})
    }
    child.stdout.on('data', pipe)
    child.stderr.on('data', pipe)
    child.on('error', (error: Error) => {
      clearTimeout(timer)
      log.close().catch(() => {})
      reject(error)
    })
    child.on('close', exitCode => {
      clearTimeout(timer)
      const durationMs = Date.now() - started
      log
        .write(
          `[${new Date().toISOString()}] exit ${String(exitCode)}${
            timedOut ? ' (timed out)' : ''
          } after ${String(durationMs)}ms\n`
        )
        .catch(() => {})
        .then(async () => {
          await log.close()
        })
        .catch(() => {})
      resolve({ exitCode, timedOut, durationMs })
    })
  })
}

/** The verdicts file text, or undefined when the agent wrote none. */
export const readVerdictsText = async (
  verdictsPath: string
): Promise<string | undefined> => {
  try {
    return await readFile(verdictsPath, 'utf8')
  } catch (error: unknown) {
    if (
      error != null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      return
    throw error
  }
}
