import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'

/**
 * Defence in depth: the agent template (see template.ts) already removes agy's built-in tools,
 * and these rules deny every action class in case a template is ever missing.
 */
export const AGY_DENY_ALL_SETTINGS = JSON.stringify({
  permissions: {
    deny: ['command(*)', 'read_file(*)', 'write_file(*)', 'read_url(*)', 'execute_url(*)', 'mcp(*)'],
  },
  toolPermission: 'strict',
})

export interface AgyUsage {
  input_tokens?: number
  output_tokens?: number
  thinking_tokens?: number
  cache_read_tokens?: number
}

export interface AgyResult {
  status: string
  response: string
  usage?: AgyUsage
}

export type AgyEvent =
  | { type: 'text', text: string }
  | { type: 'result', result: AgyResult }

export interface AgyRunOptions {
  binary: string
  /** Plugin-owned directory; agy treats it as the workspace and finds agent templates under it. */
  cwd: string
  /** Base model id, e.g. `gemini-3.8-flash`; effort goes in `effort`. */
  model: string
  effort?: 'low' | 'medium' | 'high'
  /** Agent template name (see template.ts). */
  agent?: string
  prompt: string
  signal?: AbortSignal
  /** Called on every stdout line, so an idle watchdog can restart. */
  onActivity?: () => void
}

export class AgyError extends Error {
  constructor(message: string, readonly kind: 'not-installed' | 'not-signed-in' | 'failed' | 'aborted') {
    super(message)
    this.name = 'AgyError'
  }
}

// Each agy process peaks around 230 MB, so runs take turns instead of running side by side.
let tail: Promise<void> = Promise.resolve()

async function acquireTurn(): Promise<() => void> {
  let release!: () => void
  const mine = new Promise<void>(resolve => { release = resolve })
  const previous = tail
  tail = previous.then(() => mine)
  await previous
  return release
}

/** stderr carries glog noise ("logging before google.Init"); keep only lines a user can act on. */
function usefulStderr(stderr: string): string {
  return stderr
    .split('\n')
    .filter(line => line.trim().length > 0 && !/logging before google\.Init: [IW]/.test(line))
    .slice(-4)
    .join(' | ')
    .slice(0, 600)
}

export function agyArgs(options: Pick<AgyRunOptions, 'model' | 'effort' | 'agent'>): string[] {
  return [
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--model', options.model,
    ...options.effort === undefined ? [] : ['--effort', options.effort],
    ...options.agent === undefined ? [] : ['--agent', options.agent],
    '--sandbox',
    '--settings', AGY_DENY_ALL_SETTINGS,
    // `-p` takes the next argument as its prompt, so it goes last with an empty prompt;
    // the real prompt arrives on stdin.
    '-p', '',
  ]
}

/**
 * Run one agy turn and yield answer text as it streams, then the final result.
 * The prompt travels on stdin, so its size is not bound by the argument-length limit.
 */
export async function* streamAgy(options: AgyRunOptions): AsyncGenerator<AgyEvent> {
  if (options.signal?.aborted) throw new AgyError('aborted', 'aborted')
  await mkdir(options.cwd, { recursive: true, mode: 0o700 })
  const release = await acquireTurn()
  const child = spawn(options.binary, agyArgs(options), { cwd: options.cwd, stdio: ['pipe', 'pipe', 'pipe'] })
  const queue: AgyEvent[] = []
  let wake: (() => void) | undefined
  let finished: { error?: Error } | undefined
  let stdout = ''
  let stderr = ''
  let result: AgyResult | undefined
  const notify = (): void => { wake?.(); wake = undefined }
  const finish = (error?: Error): void => {
    if (finished !== undefined) return
    finished = error === undefined ? {} : { error }
    notify()
  }
  const onAbort = (): void => { child.kill('SIGTERM') }
  options.signal?.addEventListener('abort', onAbort, { once: true })

  child.on('error', error => {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT'
    finish(new AgyError(
      missing ? `Antigravity CLI not found at ${options.binary}` : `Could not start agy: ${error.message}`,
      missing ? 'not-installed' : 'failed',
    ))
  })
  child.stderr.on('data', chunk => { stderr += String(chunk) })
  child.stdout.on('data', chunk => {
    stdout += String(chunk)
    let newline: number
    while ((newline = stdout.indexOf('\n')) >= 0) {
      const line = stdout.slice(0, newline).trim()
      stdout = stdout.slice(newline + 1)
      if (line.length === 0) continue
      options.onActivity?.()
      let event: Record<string, any>
      try { event = JSON.parse(line) as Record<string, any> } catch { continue }
      const step = event.step_update
      if (step?.step_type === 'agent_response' && typeof step.text_delta === 'string' && step.text_delta.length > 0) {
        queue.push({ type: 'text', text: step.text_delta })
        notify()
      }
      if (event.event === 'result' && event.result) {
        const r = event.result
        result = {
          status: String(r.status ?? ''),
          response: typeof r.response === 'string' ? r.response : '',
          ...r.usage === undefined ? {} : { usage: r.usage as AgyUsage },
        }
      }
    }
  })
  child.on('close', code => {
    if (options.signal?.aborted) return finish(new AgyError('aborted', 'aborted'))
    const detail = usefulStderr(stderr)
    if (/not authenticated|sign in|not logged in/i.test(detail) && result?.status !== 'SUCCESS') {
      return finish(new AgyError('The Antigravity CLI is not signed in. Run `agy` once in a terminal to sign in.', 'not-signed-in'))
    }
    if (result === undefined) return finish(new AgyError(`agy exited with code ${code ?? 'null'} without a result${detail ? `: ${detail}` : ''}`, 'failed'))
    if (result.status !== 'SUCCESS') return finish(new AgyError(`agy returned ${result.status}${detail ? `: ${detail}` : ''}`, 'failed'))
    queue.push({ type: 'result', result })
    finish()
  })
  child.stdin.on('error', () => { /* the close handler reports the real failure */ })
  child.stdin.end(JSON.stringify({ event: 'user', message: { content: options.prompt } }) + '\n')

  try {
    while (true) {
      if (queue.length > 0) { yield queue.shift()!; continue }
      if (finished !== undefined) {
        if (finished.error !== undefined) throw finished.error
        return
      }
      await new Promise<void>(resolve => { wake = resolve })
    }
  } finally {
    options.signal?.removeEventListener('abort', onAbort)
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    release()
  }
}

/** Collect a whole run; used where streaming is not needed. */
export async function runAgy(options: AgyRunOptions): Promise<AgyResult> {
  for await (const event of streamAgy(options)) if (event.type === 'result') return event.result
  throw new AgyError('agy finished without a result', 'failed')
}

export interface AgyQuota {
  /** Fraction of the weekly limit left for Gemini models, 0..1. */
  weekly?: number
  /** Fraction of the five-hour limit left for Gemini models, 0..1. */
  fiveHour?: number
  weeklyReset?: string
  fiveHourReset?: string
}

export interface AgyStatus {
  installed: boolean
  signedIn: boolean
  models: string[]
  error?: string
  version?: string
  quota?: AgyQuota
}

function capture(binary: string, args: string[], timeoutMs: number): Promise<{ stdout: string, stderr: string, error?: NodeJS.ErrnoException }> {
  return new Promise(resolve => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs)
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('error', error => { clearTimeout(timer); resolve({ stdout, stderr, error }) })
    child.on('close', () => { clearTimeout(timer); resolve({ stdout, stderr }) })
  })
}

/** Parse `agy -p /usage --output-format stream-json`: remaining quota of the Gemini model group. */
export function parseAgyQuota(stdout: string): AgyQuota | undefined {
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    let event: any
    try { event = JSON.parse(trimmed) } catch { continue }
    if (event?.event !== 'command_result' || event.command?.name !== 'usage') continue
    const groups: any[] = Array.isArray(event.command.data?.groups) ? event.command.data.groups : []
    const group = groups.find(g => /gemini/i.test(String(g?.name))) ?? groups[0]
    const quota: AgyQuota = {}
    for (const bucket of Array.isArray(group?.buckets) ? group.buckets : []) {
      const left = Number(bucket?.remaining_fraction)
      if (!Number.isFinite(left)) continue
      if (bucket.window === 'weekly') { quota.weekly = left; if (typeof bucket.reset_time === 'string') quota.weeklyReset = bucket.reset_time }
      if (bucket.window === '5h') { quota.fiveHour = left; if (typeof bucket.reset_time === 'string') quota.fiveHourReset = bucket.reset_time }
    }
    return Object.keys(quota).length > 0 ? quota : undefined
  }
  return undefined
}

/**
 * Health of the official CLI without spending quota: `agy models` needs a signed-in CLI, and
 * `/usage` reports what is left. The steps run one after another because each agy start is heavy.
 */
export async function checkAgy(binary: string, timeoutMs = 30_000): Promise<AgyStatus> {
  const listed = await capture(binary, ['models'], timeoutMs)
  if (listed.error !== undefined) {
    const missing = listed.error.code === 'ENOENT'
    return { installed: !missing, signedIn: false, models: [], error: missing ? `not found at ${binary}` : listed.error.message }
  }
  const models = listed.stdout.split('\n')
    .map(line => line.split('\t')[0]?.trim() ?? '')
    .filter(id => /^[a-z0-9][a-z0-9.\-]+$/.test(id))
  if (models.length === 0) {
    const notSignedIn = /sign in/i.test(`${listed.stdout}\n${listed.stderr}`)
    return { installed: true, signedIn: false, models: [], error: notSignedIn ? 'not signed in' : usefulStderr(listed.stderr) || 'no models listed' }
  }
  const version = /^(\d+\.\d+\.\d+)\s*$/m.exec((await capture(binary, ['--version'], 10_000)).stdout)?.[1]
  const quota = parseAgyQuota((await capture(binary, ['-p', '/usage', '--output-format', 'stream-json'], timeoutMs)).stdout)
  return {
    installed: true,
    signedIn: true,
    models,
    ...version === undefined ? {} : { version },
    ...quota === undefined ? {} : { quota },
  }
}
