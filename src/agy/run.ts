import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'

/**
 * Deny every action class the CLI knows, so `agy` only ever answers in text. DSH runs the tools.
 * Verified 2026-11-14 against agy 1.5.9: `read_file` and `run_command` both end in a permission error.
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
  structured?: unknown
  usage?: AgyUsage
}

export interface AgyRunOptions {
  binary: string
  /** Empty directory owned by the plugin; agy treats it as the workspace. */
  cwd: string
  model: string
  prompt: string
  /** JSON schema for the final answer; omitted for plain-text calls. */
  schema?: object
  signal?: AbortSignal
  /** Called for each streamed text fragment (only meaningful without a schema). */
  onText?: (text: string) => void
  /** Called on every stdout line, so an idle watchdog can restart. */
  onActivity?: () => void
}

export class AgyError extends Error {
  constructor(message: string, readonly kind: 'not-installed' | 'not-signed-in' | 'failed' | 'aborted') {
    super(message)
    this.name = 'AgyError'
  }
}

// Each agy process peaks around 230 MB, so requests queue instead of running side by side.
let running: Promise<unknown> = Promise.resolve()

function queued<T>(task: () => Promise<T>): Promise<T> {
  const next = running.then(task, task)
  running = next.catch(() => undefined)
  return next
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

function runOnce(options: AgyRunOptions): Promise<AgyResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) return reject(new AgyError('aborted', 'aborted'))
    const args = [
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--model', options.model,
      '--sandbox',
      '--settings', AGY_DENY_ALL_SETTINGS,
      ...options.schema === undefined ? [] : ['--json-schema', JSON.stringify(options.schema)],
      // `-p` takes the next argument as its prompt, so it goes last with an empty prompt;
      // the real prompt arrives on stdin.
      '-p', '',
    ]
    const child = spawn(options.binary, args, { cwd: options.cwd, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let result: AgyResult | undefined
    const onAbort = (): void => { child.kill('SIGTERM') }
    options.signal?.addEventListener('abort', onAbort, { once: true })

    child.on('error', error => {
      options.signal?.removeEventListener('abort', onAbort)
      const missing = (error as NodeJS.ErrnoException).code === 'ENOENT'
      reject(new AgyError(
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
          options.onText?.(step.text_delta)
        }
        if (event.event === 'result' && event.result) {
          const r = event.result
          result = {
            status: String(r.status ?? ''),
            response: typeof r.response === 'string' ? r.response : '',
            ...r.structured_output === undefined ? {} : { structured: r.structured_output },
            ...r.usage === undefined ? {} : { usage: r.usage as AgyUsage },
          }
        }
      }
    })
    child.on('close', code => {
      options.signal?.removeEventListener('abort', onAbort)
      if (options.signal?.aborted) return reject(new AgyError('aborted', 'aborted'))
      const detail = usefulStderr(stderr)
      if (/not authenticated|sign in/i.test(detail) && result?.status !== 'SUCCESS') {
        return reject(new AgyError('The Antigravity CLI is not signed in. Run `agy` once in a terminal to sign in.', 'not-signed-in'))
      }
      if (result === undefined) {
        return reject(new AgyError(`agy exited with code ${code ?? 'null'} without a result${detail ? `: ${detail}` : ''}`, 'failed'))
      }
      if (result.status !== 'SUCCESS') {
        return reject(new AgyError(`agy returned ${result.status}${detail ? `: ${detail}` : ''}`, 'failed'))
      }
      resolve(result)
    })

    child.stdin.on('error', () => { /* the close handler reports the real failure */ })
    child.stdin.end(JSON.stringify({ event: 'user', message: { content: options.prompt } }) + '\n')
  })
}

export async function runAgy(options: AgyRunOptions): Promise<AgyResult> {
  await mkdir(options.cwd, { recursive: true, mode: 0o700 })
  return queued(() => runOnce(options))
}

export interface AgyStatus {
  installed: boolean
  signedIn: boolean
  models: string[]
  error?: string
}

/** `agy models` needs a signed-in CLI but runs no agent, so it is a cheap health check. */
export function checkAgy(binary: string, timeoutMs = 30_000): Promise<AgyStatus> {
  return new Promise(resolve => {
    const child = spawn(binary, ['models'], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs)
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('error', error => {
      clearTimeout(timer)
      const missing = (error as NodeJS.ErrnoException).code === 'ENOENT'
      resolve({ installed: !missing, signedIn: false, models: [], error: missing ? `not found at ${binary}` : error.message })
    })
    child.on('close', () => {
      clearTimeout(timer)
      const text = `${stdout}\n${stderr}`
      const models = stdout.split('\n')
        .map(line => line.split('\t')[0]?.trim() ?? '')
        .filter(id => /^[a-z0-9][a-z0-9.\-]+$/.test(id))
      if (/sign in/i.test(text) && models.length === 0) return resolve({ installed: true, signedIn: false, models: [], error: 'not signed in' })
      resolve({ installed: true, signedIn: models.length > 0, models, ...models.length > 0 ? {} : { error: usefulStderr(stderr) || 'no models listed' } })
    })
  })
}
