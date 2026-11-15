import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, open, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Environment for every agy process the plugin starts. agy otherwise checks for a new release every
 * 15 minutes and starts a background updater process, which can replace the binary between two
 * requests. The variable is built into agy 1.5.9 (`auto_updater.go`: "Auto-update disabled via
 * environment variable"); only the value `true` works, `1` does not (verified 2026-11-15). Run
 * `agy update` to update by hand. Interactive `agy` runs still update themselves.
 */
export function agyEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...base, AGY_CLI_DISABLE_AUTO_UPDATE: 'true' }
}

/**
 * Session-only agy settings. Every action class is denied, and the trusted workspace is narrowed
 * to the run's own folder: agy otherwise treats a trusted ancestor (for example the home folder
 * the user signed in from) as readable. An image request drops the `read_file` denial so the file
 * viewer can open the images staged in that folder; reads outside it still fail (verified on 1.5.9).
 */
export function agySettings(cwd: string, allowWorkspaceRead = false): string {
  return JSON.stringify({
    permissions: {
      deny: [
        'command(*)',
        ...allowWorkspaceRead ? [] : ['read_file(*)'],
        'write_file(*)',
        'read_url(*)',
        'execute_url(*)',
        'mcp(*)',
      ],
    },
    trustedWorkspaces: [cwd],
    ...allowWorkspaceRead ? {} : { toolPermission: 'strict' },
  })
}

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
  /** File-viewer steps that completed; an image request needs at least one. */
  readsDone: number
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
  /** Let agy's file viewer read inside `cwd` (image requests). Everything else stays denied. */
  allowWorkspaceRead?: boolean
  /** Give up with `busy` after waiting this long for another run to finish. */
  queueTimeoutMs?: number
  /**
   * agy retries a refused model call up to eight times in silence (about two minutes). Give up
   * once this many attempts have failed; the reason comes from agy's run log.
   */
  maxUpstreamAttempts?: number
}

export type AgyErrorKind =
  | 'not-installed'
  | 'not-signed-in'
  | 'failed'
  | 'aborted'
  /** Another run held the queue for longer than `queueTimeoutMs`. */
  | 'busy'
  /** Google has no capacity for the model right now (503). */
  | 'capacity'
  /** Google refused the call for another reason (quota, rate limit, …). */
  | 'upstream'
  /** An image was attached but agy never opened it. */
  | 'image-unread'
  /** An attached image cannot be sent (type, size, count). */
  | 'image-rejected'

export class AgyError extends Error {
  constructor(message: string, readonly kind: AgyErrorKind) {
    super(message)
    this.name = 'AgyError'
  }
}

// Each agy process peaks around 230 MB, so runs take turns instead of running side by side.
let tail: Promise<void> = Promise.resolve()

async function acquireTurn(signal?: AbortSignal, timeoutMs?: number): Promise<() => void> {
  let release!: () => void
  const mine = new Promise<void>(resolve => { release = resolve })
  const previous = tail
  tail = previous.then(() => mine)
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      void previous.then(resolve)
      if (signal !== undefined) {
        if (signal.aborted) return reject(new AgyError('aborted', 'aborted'))
        onAbort = () => reject(new AgyError('aborted', 'aborted'))
        signal.addEventListener('abort', onAbort, { once: true })
      }
      if (timeoutMs !== undefined) {
        timer = setTimeout(() => reject(new AgyError(
          `the Antigravity CLI is busy with another request (waited ${Math.round(timeoutMs / 1000)} s)`, 'busy',
        )), timeoutMs)
      }
    })
  } catch (error) {
    // Leave the line without blocking it: hand the turn on as soon as it would have arrived.
    void previous.then(release)
    throw error
  } finally {
    clearTimeout(timer)
    if (onAbort !== undefined) signal?.removeEventListener('abort', onAbort)
  }
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

export function agyArgs(options: Pick<AgyRunOptions, 'cwd' | 'model' | 'effort' | 'agent' | 'allowWorkspaceRead'>, logFile?: string): string[] {
  return [
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--model', options.model,
    ...options.effort === undefined ? [] : ['--effort', options.effort],
    ...options.agent === undefined ? [] : ['--agent', options.agent],
    '--sandbox',
    '--settings', agySettings(options.cwd, options.allowWorkspaceRead === true),
    ...logFile === undefined ? [] : ['--log-file', logFile],
    // `-p` takes the next argument as its prompt, so it goes last with an empty prompt;
    // the real prompt arrives on stdin.
    '-p', '',
  ]
}

const RETRY_LINE = /Run: attempt (\d+) failed \((.*)\), retrying in/g

function upstreamError(reason: string, model: string): AgyError {
  const capacity = /UNAVAILABLE|code 503|No capacity/i.test(reason)
  return new AgyError(
    capacity
      ? `Google has no capacity for ${model} right now (${reason.slice(0, 200)})`
      : `Google refused the request (${reason.slice(0, 300)})`,
    capacity ? 'capacity' : 'upstream',
  )
}

/** Read the bytes appended to `file` since `offset`; a missing file reads as nothing. */
async function readFrom(file: string, offset: number): Promise<{ text: string, offset: number }> {
  try {
    const handle = await open(file, 'r')
    try {
      const { size } = await handle.stat()
      if (size <= offset) return { text: '', offset }
      const buffer = Buffer.alloc(size - offset)
      await handle.read(buffer, 0, buffer.length, offset)
      return { text: buffer.toString('utf8'), offset: size }
    } finally {
      await handle.close()
    }
  } catch {
    return { text: '', offset }
  }
}

/**
 * Run one agy turn and yield answer text as it streams, then the final result.
 * The prompt travels on stdin, so its size is not bound by the argument-length limit.
 */
export async function* streamAgy(options: AgyRunOptions): AsyncGenerator<AgyEvent> {
  if (options.signal?.aborted) throw new AgyError('aborted', 'aborted')
  await mkdir(options.cwd, { recursive: true, mode: 0o700 })
  const release = await acquireTurn(options.signal, options.queueTimeoutMs)
  // Outside the workspace, so agy's own file watcher does not react to its log.
  const logFile = join(tmpdir(), `dsh-agy-run-${randomUUID()}.log`)
  let child: ReturnType<typeof spawn> | undefined
  let poll: ReturnType<typeof setInterval> | undefined
  const onAbort = (): void => { child?.kill('SIGTERM') }
  try {
    const queue: AgyEvent[] = []
    let wake: (() => void) | undefined
    let finished: { error?: Error } | undefined
    let stdout = ''
    let stderr = ''
    let result: AgyResult | undefined
    let readsDone = 0
    let lastRefusal: string | undefined
    let gaveUp: AgyError | undefined
    const notify = (): void => { wake?.(); wake = undefined }
    const finish = (error?: Error): void => {
      if (finished !== undefined) return
      finished = error === undefined ? {} : { error }
      notify()
    }

    child = spawn(options.binary, agyArgs(options, logFile), { cwd: options.cwd, env: agyEnv(), stdio: ['pipe', 'pipe', 'pipe'] })
    const running = child
    options.signal?.addEventListener('abort', onAbort, { once: true })

    // agy reports refused model calls only in its log, so follow it while the run is quiet.
    let logOffset = 0
    let reading = false
    const followLog = async (): Promise<void> => {
      if (reading) return
      reading = true
      try {
        const chunk = await readFrom(logFile, logOffset)
        logOffset = chunk.offset
        for (const match of chunk.text.matchAll(RETRY_LINE)) {
          lastRefusal = match[2]!
          if (gaveUp === undefined && options.maxUpstreamAttempts !== undefined && Number(match[1]) >= options.maxUpstreamAttempts) {
            gaveUp = upstreamError(lastRefusal, options.model)
            running.kill('SIGTERM')
          }
        }
      } finally {
        reading = false
      }
    }
    poll = setInterval(() => { void followLog() }, 700)

    running.on('error', error => {
      const missing = (error as NodeJS.ErrnoException).code === 'ENOENT'
      finish(new AgyError(
        missing ? `Antigravity CLI not found at ${options.binary}` : `Could not start agy: ${error.message}`,
        missing ? 'not-installed' : 'failed',
      ))
    })
    running.stderr!.on('data', chunk => { stderr += String(chunk) })
    running.stdout!.on('data', chunk => {
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
        if (step?.step_type === 'tool' && step.state === 'DONE' && /^(read_file|view_file)$/.test(String(step.tool_name))) readsDone += 1
        if (event.event === 'result' && event.result) {
          const r = event.result
          result = {
            status: String(r.status ?? ''),
            response: typeof r.response === 'string' ? r.response : '',
            ...r.usage === undefined ? {} : { usage: r.usage as AgyUsage },
            readsDone,
          }
        }
      }
    })
    running.on('close', code => {
      void (async () => {
        await followLog()
        if (gaveUp !== undefined) return finish(gaveUp)
        if (options.signal?.aborted) return finish(new AgyError('aborted', 'aborted'))
        const detail = usefulStderr(stderr)
        if (/not authenticated|sign in|not logged in/i.test(detail) && result?.status !== 'SUCCESS') {
          return finish(new AgyError('The Antigravity CLI is not signed in. Run `agy` once in a terminal to sign in.', 'not-signed-in'))
        }
        if (result?.status === 'SUCCESS') {
          result.readsDone = readsDone
          queue.push({ type: 'result', result })
          return finish()
        }
        // agy gave up by itself after its own retries; its log holds the reason.
        if (lastRefusal !== undefined) return finish(upstreamError(lastRefusal, options.model))
        if (result === undefined) return finish(new AgyError(`agy exited with code ${code ?? 'null'} without a result${detail ? `: ${detail}` : ''}`, 'failed'))
        finish(new AgyError(`agy returned ${result.status}${detail ? `: ${detail}` : ''}`, 'failed'))
      })()
    })
    running.stdin!.on('error', () => { /* the close handler reports the real failure */ })
    running.stdin!.end(JSON.stringify({ event: 'user', message: { content: options.prompt } }) + '\n')

    while (true) {
      if (queue.length > 0) { yield queue.shift()!; continue }
      if (finished !== undefined) {
        if (finished.error !== undefined) throw finished.error
        return
      }
      await new Promise<void>(resolve => { wake = resolve })
    }
  } finally {
    clearInterval(poll)
    options.signal?.removeEventListener('abort', onAbort)
    if (child !== undefined && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    void unlink(logFile).catch(() => undefined)
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
    const child = spawn(binary, args, { env: agyEnv(), stdio: ['ignore', 'pipe', 'pipe'] })
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
