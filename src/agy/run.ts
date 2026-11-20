import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { chmod, mkdir, open, readdir, rm, stat, unlink } from 'node:fs/promises'
import { freemem, homedir, tmpdir } from 'node:os'
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
  /** File-viewer steps that completed. */
  readsDone: number
  /** Paths the file viewer opened; an image request needs each of its new images here. */
  filesRead: string[]
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
  /** Keep the conversation agy saves for this run (by default it is deleted afterwards). */
  keepConversation?: boolean
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
  /** The input is above agy's own cap for the model ("maxMessageTokens must be positive"). */
  | 'too-large'
  /** Google answered 429 RESOURCE_EXHAUSTED; the account is held back for a while. */
  | 'rate-limited'

export class AgyError extends Error {
  constructor(message: string, readonly kind: AgyErrorKind) {
    super(message)
    this.name = 'AgyError'
  }
}

/**
 * Each agy process peaks around 230 MB. A second process runs beside the first only while the
 * host has memory to spare: this host is small, and the kernel's OOM killer would pick the
 * biggest process, which is DSH itself.
 */
export const AGY_MAX_PARALLEL = 2
export const AGY_SECOND_SLOT_MIN_AVAILABLE_BYTES = 700 * 1024 * 1024
let running = 0
const waiting: Array<() => void> = []

/** Memory the kernel can give to a new process (`MemAvailable`), in bytes. */
function availableMemory(): number {
  try {
    const match = /^MemAvailable:\s+(\d+) kB$/m.exec(readFileSync('/proc/meminfo', 'utf8'))
    if (match !== null) return Number(match[1]) * 1024
  } catch { /* not Linux */ }
  return freemem()
}
let memoryProbe: () => number = availableMemory

/** For tests: replace the memory probe; call without an argument to restore it. */
export function setMemoryProbe(probe?: () => number): void {
  memoryProbe = probe ?? availableMemory
}

function canStart(): boolean {
  if (running === 0) return true
  return running < AGY_MAX_PARALLEL && memoryProbe() >= AGY_SECOND_SLOT_MIN_AVAILABLE_BYTES
}

/** Start waiting requests while slots (and memory) allow, oldest first. */
function pump(): void {
  while (waiting.length > 0 && canStart()) {
    running += 1
    waiting.shift()!()
  }
}

async function acquireTurn(signal?: AbortSignal, timeoutMs?: number): Promise<() => void> {
  if (signal?.aborted) throw new AgyError('aborted', 'aborted')
  if (waiting.length === 0 && canStart()) {
    running += 1
  } else {
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const leave = (error: AgyError): void => {
        const at = waiting.indexOf(grant)
        if (at < 0) return
        waiting.splice(at, 1)
        cleanup()
        reject(error)
      }
      const onAbort = (): void => leave(new AgyError('aborted', 'aborted'))
      const cleanup = (): void => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
      }
      const grant = (): void => { cleanup(); resolve() }
      waiting.push(grant)
      signal?.addEventListener('abort', onAbort, { once: true })
      if (timeoutMs !== undefined) {
        timer = setTimeout(() => leave(new AgyError(
          `the Antigravity CLI is busy with other requests (waited ${Math.round(timeoutMs / 1000)} s)`, 'busy',
        )), timeoutMs)
      }
    })
  }
  let released = false
  return () => {
    if (released) return
    released = true
    running -= 1
    pump()
  }
}

/**
 * After Google refuses a model for lack of capacity, further requests for it fail at once for a
 * short time instead of each spending several attempts to learn the same thing.
 */
export const CAPACITY_COOLDOWN_MS = 45_000
const capacityUntil = new Map<string, number>()
const capacityKey = (options: Pick<AgyRunOptions, 'model' | 'effort'>): string => `${options.model}/${options.effort ?? ''}`

/** Seconds until a model that Google refused for capacity is tried again; 0 when it is not held back. */
export function capacityRetryAfter(options: Pick<AgyRunOptions, 'model' | 'effort'>, now = Date.now()): number {
  const until = capacityUntil.get(capacityKey(options)) ?? 0
  return until > now ? Math.ceil((until - now) / 1000) : 0
}

/**
 * After a 429, no request goes to Google for this long, for any model. A 429 with quota left is
 * how Google answers traffic it is limiting; agy's own retries (eight in about two minutes)
 * would only send more of it, so the run stops at the first 429 and the account rests.
 */
export const RATE_LIMIT_HOLD_MS = 5 * 60_000
let rateLimitedUntil = 0

/** Seconds until requests go to Google again after a 429; 0 when not held back. */
export function rateLimitRetryAfter(now = Date.now()): number {
  return rateLimitedUntil > now ? Math.ceil((rateLimitedUntil - now) / 1000) : 0
}

/** For tests: forget every capacity refusal and 429. */
export function resetCapacityCooldown(): void {
  capacityUntil.clear()
  rateLimitedUntil = 0
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
/** agy's message when the input does not fit the model's window (agy 1.5.9). */
const TOO_LARGE = /maxMessageTokens must be positive|exceeds? (the )?(context|token) (window|limit)/i

const RATE_LIMITED = /RESOURCE_EXHAUSTED|code 429/i

function upstreamError(reason: string, model: string): AgyError {
  if (RATE_LIMITED.test(reason)) {
    return new AgyError(`Google refused the request with 429 (${reason.slice(0, 200)}); no requests for ${RATE_LIMIT_HOLD_MS / 60_000} min`, 'rate-limited')
  }
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
  const resting = rateLimitRetryAfter()
  if (resting > 0) {
    throw new AgyError(`Google answered 429 a moment ago; requests resume in ${resting} s`, 'rate-limited')
  }
  const holdOff = capacityRetryAfter(options)
  if (holdOff > 0) {
    throw new AgyError(`Google had no capacity for ${options.model} a moment ago; the next attempt is in ${holdOff} s`, 'capacity')
  }
  await mkdir(options.cwd, { recursive: true, mode: 0o700 })
  const release = await acquireTurn(options.signal, options.queueTimeoutMs)
  let child: ReturnType<typeof spawn> | undefined
  let poll: ReturnType<typeof setInterval> | undefined
  let logFile: string | undefined
  let conversationId: string | undefined
  const onAbort = (): void => { if (child !== undefined) stopChild(child) }
  try {
    // The signal may have fired while this request waited for its turn.
    if (options.signal?.aborted) throw new AgyError('aborted', 'aborted')
    logFile = join(await agyLogDir(), `run-${randomUUID()}.log`)
    const log = logFile
    const queue: AgyEvent[] = []
    let wake: (() => void) | undefined
    let finished: { error?: Error } | undefined
    let stdout = ''
    let stderr = ''
    let result: AgyResult | undefined
    let readsDone = 0
    const filesRead = new Set<string>()
    // Any model output means a model call succeeded, so an earlier refusal did not end the run.
    let sawModelOutput = false
    let lastRefusal: string | undefined
    let resultError: string | undefined
    let gaveUp: AgyError | undefined
    const notify = (): void => { wake?.(); wake = undefined }
    const finish = (error?: Error): void => {
      if (finished !== undefined) return
      finished = error === undefined ? {} : { error }
      notify()
    }

    child = spawn(options.binary, agyArgs(options, log), { cwd: options.cwd, env: agyEnv(), stdio: ['pipe', 'pipe', 'pipe'] })
    const running = child
    options.signal?.addEventListener('abort', onAbort, { once: true })

    // agy reports refused model calls only in its log, so follow it while the run is quiet.
    // Reads are chained, so the final read after exit waits for one that is in progress.
    let logOffset = 0
    let logChain: Promise<void> = Promise.resolve()
    const readLog = async (): Promise<void> => {
      const chunk = await readFrom(log, logOffset)
      logOffset = chunk.offset
      for (const match of chunk.text.matchAll(RETRY_LINE)) {
        lastRefusal = match[2]!
        const limit = RATE_LIMITED.test(lastRefusal) ? 1 : options.maxUpstreamAttempts
        if (gaveUp === undefined && limit !== undefined && Number(match[1]) >= limit) {
          gaveUp = upstreamError(lastRefusal, options.model)
          stopChild(running)
        }
      }
    }
    const followLog = (): Promise<void> => (logChain = logChain.then(readLog, readLog))
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
        const id = step?.conversation_id ?? event.result?.conversation_id
        if (typeof id === 'string' && id.length > 0) conversationId = id
        if (step?.step_type === 'agent_response' && typeof step.text_delta === 'string' && step.text_delta.length > 0) {
          sawModelOutput = true
          queue.push({ type: 'text', text: step.text_delta })
          notify()
        }
        if (step?.step_type === 'tool') {
          sawModelOutput = true
          if (step.state === 'DONE' && /^(read_file|view_file)$/.test(String(step.tool_name))) {
            readsDone += 1
            const parameters = step.tool_info?.parameters ?? {}
            const path = parameters.Path ?? parameters.path ?? parameters.AbsolutePath ?? parameters.absolute_path
            if (typeof path === 'string') filesRead.add(path)
          }
        }
        if (event.event === 'result' && event.result) {
          const r = event.result
          if (typeof r.error === 'string' && r.error.length > 0) resultError = r.error
          result = {
            status: String(r.status ?? ''),
            response: typeof r.response === 'string' ? r.response : '',
            ...r.usage === undefined ? {} : { usage: r.usage as AgyUsage },
            readsDone,
            filesRead: [...filesRead],
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
          result.filesRead = [...filesRead]
          queue.push({ type: 'result', result })
          return finish()
        }
        if (resultError !== undefined && TOO_LARGE.test(resultError)) {
          return finish(new AgyError(`the request is larger than the Antigravity CLI accepts for ${options.model} (${resultError.slice(0, 200)})`, 'too-large'))
        }
        // agy gave up by itself after its own retries, before any model call succeeded.
        if (lastRefusal !== undefined && !sawModelOutput) return finish(upstreamError(lastRefusal, options.model))
        const refusal = lastRefusal === undefined ? '' : ` (earlier refusal: ${lastRefusal.slice(0, 200)})`
        const reason = resultError === undefined ? '' : `: ${resultError.slice(0, 300)}`
        if (result === undefined) return finish(new AgyError(`agy exited with code ${code ?? 'null'} without a result${reason}${detail ? `: ${detail}` : ''}${refusal}`, 'failed'))
        finish(new AgyError(`agy returned ${result.status}${reason}${detail ? `: ${detail}` : ''}${refusal}`, 'failed'))
      })()
    })
    running.stdin!.on('error', () => { /* the close handler reports the real failure */ })
    running.stdin!.end(JSON.stringify({ event: 'user', message: { content: options.prompt } }) + '\n')

    while (true) {
      if (queue.length > 0) { yield queue.shift()!; continue }
      if (finished !== undefined) {
        if (finished.error instanceof AgyError && finished.error.kind === 'capacity') {
          capacityUntil.set(capacityKey(options), Date.now() + CAPACITY_COOLDOWN_MS)
        }
        if (finished.error instanceof AgyError && finished.error.kind === 'rate-limited') {
          rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + RATE_LIMIT_HOLD_MS)
        }
        if (finished.error !== undefined) throw finished.error
        capacityUntil.delete(capacityKey(options))
        return
      }
      await new Promise<void>(resolve => { wake = resolve })
    }
  } finally {
    clearInterval(poll)
    options.signal?.removeEventListener('abort', onAbort)
    const forget = conversationId
    const log = logFile
    const cleanUp = (): void => {
      if (log !== undefined) void unlink(log).catch(() => undefined)
      if (forget !== undefined && options.keepConversation !== true) void forgetConversation(forget)
      release()
    }
    // The slot is free only once the process is gone, so two never overlap on a closed stream.
    if (child !== undefined && child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
      let done = false
      const once = (): void => { if (!done) { done = true; cleanUp() } }
      child.once('close', once)
      // Never hold the slot for ever, even if 'close' does not come after the kill.
      setTimeout(once, AGY_KILL_GRACE_MS + 2_000).unref()
      stopChild(child)
    } else {
      cleanUp()
    }
  }
}

/**
 * agy saves every run as a conversation (a database, a "brain" folder and a lock file under
 * ~/.gemini/antigravity-cli). The plugin never resumes one, and they hold the full prompt, so
 * they only use disk (about 90 MB a day at Nami's volume) and keep chat text around.
 */
export function agyAppDataDir(): string {
  return join(homedir(), '.gemini', 'antigravity-cli')
}

const CONVERSATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export async function forgetConversation(id: string, appDataDir = agyAppDataDir()): Promise<void> {
  if (!CONVERSATION_ID.test(id)) return
  await Promise.all([
    ...['.db', '.db-wal', '.db-shm'].map(suffix => rm(join(appDataDir, 'conversations', id + suffix), { force: true })),
    rm(join(appDataDir, 'presence', `${id}.lock`), { force: true }),
    rm(join(appDataDir, 'brain', id), { recursive: true, force: true }),
  ]).catch(() => undefined)
}

/** Ask agy to stop; kill it if it is still there after a grace period. */
export const AGY_KILL_GRACE_MS = 5_000
function stopChild(child: ReturnType<typeof spawn>): void {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  const timer = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }, AGY_KILL_GRACE_MS)
  timer.unref()
  child.once('close', () => clearTimeout(timer))
}

const LOG_MAX_AGE_MS = 60 * 60_000
let logDirReady: Promise<string> | undefined

/**
 * Private folder for agy run logs (they can quote request details): mode 0700, outside every
 * folder agy may read. Logs left by a killed process are removed after an hour.
 */
function agyLogDir(): Promise<string> {
  logDirReady ??= (async () => {
    const dir = join(tmpdir(), `dsh-agy-logs-${process.getuid?.() ?? 'user'}`)
    await mkdir(dir, { recursive: true, mode: 0o700 })
    await chmod(dir, 0o700)
    const now = Date.now()
    for (const name of await readdir(dir).catch(() => [] as string[])) {
      const file = join(dir, name)
      const info = await stat(file).catch(() => undefined)
      if (info !== undefined && now - info.mtimeMs > LOG_MAX_AGE_MS) await unlink(file).catch(() => undefined)
    }
    return dir
  })().catch(error => { logDirReady = undefined; throw error })
  return logDirReady
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

export function capture(binary: string, args: string[], timeoutMs: number): Promise<{ stdout: string, stderr: string, error?: NodeJS.ErrnoException }> {
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
