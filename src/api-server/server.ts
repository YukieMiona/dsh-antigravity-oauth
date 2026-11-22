import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { isPublicModelId, isReasoningEffort, publicModel, routeChatModel, thinkingLevelFor } from '../models.ts'
import { isAccountBannedError } from '../ban.ts'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import { lastAgyReading } from '../agy/quota-watch.ts'
import { AgyError, CAPACITY_COOLDOWN_MS, rateLimitRetryAfter, stopAgySpare } from '../agy/run.ts'
import { agyTurn, agyWorkspace, type AgyImage } from '../agy/turn.ts'
import { chatCompletionsUrl, type ManagerSettings } from '../manager/store.ts'
import type { AntigravitySession } from '../session.ts'
import type {
  ChatGenerateInput,
  FunctionToolDeclaration,
  GeminiContent,
  GeminiPart,
  PublicModelId,
  ReasoningEffort,
} from '../types.ts'
import type { AntigravityApiServerStore } from './store.ts'
import type { ApiServerSettings, ApiServerStatus, OpenAiModelsResponse } from './types.ts'

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(data))
}

function sendError(res: ServerResponse, status: number, message: string, type = 'invalid_request_error', code?: string, retryAfter?: number): void {
  if (retryAfter !== undefined && retryAfter > 0) res.setHeader('Retry-After', String(Math.ceil(retryAfter)))
  sendJson(res, status, {
    error: {
      message,
      type,
      ...(code ? { code } : {}),
    },
  })
}

async function readBodyJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = []
  let totalLength = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalLength += buf.length
    if (totalLength > 30 * 1024 * 1024) {
      throw new Error('Request payload too large (>30MB)')
    }
    chunks.push(buf)
  }
  if (chunks.length === 0) return {}
  const raw = Buffer.concat(chunks).toString('utf-8')
  return JSON.parse(raw)
}

function openAiText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return content === null || content === undefined ? '' : JSON.stringify(content)
  return content.map((part: any) => part?.type === 'text' && typeof part.text === 'string' ? part.text : '').filter(Boolean).join('\n')
}

/** Images of an OpenAI request by the block that stands for them; a string says why one cannot be sent. */
export type OpenAiImages = Map<object, AgyImage | string>

/** User or tool content as DSH blocks; each `image_url` part becomes an image block recorded in `images`. */
function openAiBlocks(content: unknown, images: OpenAiImages): unknown[] {
  if (!Array.isArray(content)) return [{ type: 'text', text: openAiText(content) }]
  const blocks: unknown[] = []
  for (const part of content) {
    if (part?.type === 'text' && typeof part.text === 'string') blocks.push({ type: 'text', text: part.text })
    if (part?.type !== 'image_url') continue
    const block = { type: 'image', attachment: { name: `image-${images.size + 1}` } }
    const url = typeof part.image_url === 'string' ? part.image_url : String(part.image_url?.url ?? '')
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(url)
    images.set(block, match === null
      ? 'only base64 data URLs are accepted in image_url on this route'
      : { mimeType: match[1]!, data: Buffer.from(match[2]!, 'base64') })
    blocks.push(block)
  }
  return blocks
}

/** Reshape an OpenAI chat request into the fields agy/turn.ts reads. */
export function openAiToRequest(body: any, images: OpenAiImages = new Map()): Pick<GenerateOptions, 'messages' | 'system' | 'tools'> {
  const system: string[] = []
  const messages: unknown[] = []
  for (const msg of Array.isArray(body?.messages) ? body.messages : []) {
    if (!msg || typeof msg !== 'object') continue
    if (msg.role === 'system' || msg.role === 'developer') {
      const text = openAiText(msg.content).trim()
      if (text.length > 0) system.push(text)
    } else if (msg.role === 'user') {
      messages.push({ role: 'user', content: openAiBlocks(msg.content, images) })
    } else if (msg.role === 'assistant') {
      const content: unknown[] = []
      const text = openAiText(msg.content)
      if (text.length > 0) content.push({ type: 'text', text })
      for (const call of Array.isArray(msg.tool_calls) ? msg.tool_calls : []) {
        const args = call?.function?.arguments
        content.push({ type: 'tool-call', id: String(call?.id ?? ''), name: String(call?.function?.name ?? ''), arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}) })
      }
      messages.push({ role: 'assistant', content })
    } else if (msg.role === 'tool') {
      messages.push({ role: 'tool', toolCallId: String(msg.tool_call_id ?? ''), content: openAiBlocks(msg.content, images) })
    }
  }
  const tools = (Array.isArray(body?.tools) ? body.tools : [])
    .filter((tool: any) => tool?.type === 'function' && typeof tool.function?.name === 'string')
    .map((tool: any) => ({
      name: tool.function.name as string,
      description: typeof tool.function.description === 'string' ? tool.function.description : '',
      parameters: (tool.function.parameters ?? { type: 'object' }) as Record<string, unknown>,
    }))
  return {
    messages: messages as GenerateOptions['messages'],
    ...system.length > 0 ? { system: system.join('\n\n') } : {},
    ...tools.length > 0 ? { tools } : {},
  }
}

/**
 * How long a request may go without any sign of progress before its first answer event; then it
 * gets a 504. On the Official CLI route every line agy prints counts as progress, because a
 * tool-call answer or an answer about an image arrives in one piece at the end.
 */
export const FIRST_EVENT_DEADLINE_MS = 120_000
/** How long a request may wait behind other Official CLI requests before it gets a 503. */
export const AGY_QUEUE_TIMEOUT_MS = 20_000
/** Refused model calls after which the Official CLI route gives up (agy alone would retry for two minutes). */
export const AGY_MAX_UPSTREAM_ATTEMPTS = 3

/** What a client may tell the Official CLI route about one request. */
export interface AgyRequestHints {
  /** Epoch ms by which the client needs the answer to start (`X-Request-Deadline-Ms`: a budget in ms from now). */
  deadlineAt?: number
  /** `X-Priority: interactive`: wait in the queue ahead of other requests. */
  interactive?: boolean
}

/** Read `X-Request-Deadline-Ms` and `X-Priority`; a value that does not parse is ignored. */
export function agyHintsOf(headers: Record<string, string | string[] | undefined>, now = Date.now()): AgyRequestHints {
  const first = (value: string | string[] | undefined): string | undefined => Array.isArray(value) ? value[0] : value
  const budget = Number(first(headers['x-request-deadline-ms'])?.trim())
  const priority = first(headers['x-priority'])?.trim().toLowerCase()
  return {
    ...Number.isFinite(budget) && budget > 0 ? { deadlineAt: now + Math.min(budget, FIRST_EVENT_DEADLINE_MS) } : {},
    ...priority === 'interactive' ? { interactive: true } : {},
  }
}

export interface HttpFailure { status: number, message: string, type: string, code?: string, /** Seconds for a `Retry-After` header. */ retryAfter?: number }

/** The HTTP answer for a failed completion: a client must be able to tell "try later" from "do not retry". */
export function httpFailureOf(error: unknown, timedOut = false): HttpFailure {
  const message = error instanceof Error ? error.message : String(error)
  if (timedOut) return { status: 504, message: `No progress for ${FIRST_EVENT_DEADLINE_MS / 1000} s before the answer started.`, type: 'server_error', code: 'upstream_timeout' }
  if (error instanceof AgyError) {
    switch (error.kind) {
      case 'capacity': return { status: 503, message, type: 'server_error', code: 'model_capacity_exhausted', retryAfter: CAPACITY_COOLDOWN_MS / 1000 }
      case 'busy': return { status: 503, message, type: 'server_error', code: 'server_busy', retryAfter: 5 }
      case 'not-installed':
      case 'not-signed-in': return { status: 503, message, type: 'server_error', code: 'agy_unavailable' }
      case 'image-rejected': return { status: 400, message, type: 'invalid_request_error', code: 'image_input_not_supported' }
      case 'image-unread': return { status: 502, message, type: 'upstream_error', code: 'image_not_read' }
      case 'rate-limited': return { status: 429, message, type: 'rate_limit_error', code: 'rate_limit_exceeded', retryAfter: Math.max(1, Math.ceil((error.retryAfterMs ?? rateLimitRetryAfter() * 1000) / 1000)) }
      // Answered at once, before any call to Google, so a client can use its fallback right away.
      case 'deadline': return { status: 503, message, type: 'server_error', code: 'deadline_unreachable' }
      case 'too-large': return { status: 400, message, type: 'invalid_request_error', code: 'context_length_exceeded' }
      case 'upstream':
        return /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(message)
          ? { status: 429, message, type: 'rate_limit_error', code: 'rate_limit_exceeded' }
          : { status: 502, message, type: 'upstream_error', code: 'upstream_refused' }
      default: return { status: 502, message, type: 'upstream_error', code: 'agy_failed' }
    }
  }
  return { status: 500, message: message || 'Upstream CCA generation error', type: 'upstream_error' }
}

/** Put an event that was read ahead back in front of its stream. */
async function* resume<T>(head: IteratorResult<T>, iterator: AsyncIterator<T>): AsyncGenerator<T> {
  try {
    if (head.done) return
    yield head.value
    while (true) {
      const next = await iterator.next()
      if (next.done) return
      yield next.value
    }
  } finally {
    await iterator.return?.()
  }
}

function parseOpenAiMessages(rawMessages: any[]): { system?: string, contents: GeminiContent[] } {
  const contents: GeminiContent[] = []
  const systemParts: string[] = []

  for (const msg of rawMessages) {
    if (!msg || typeof msg !== 'object') continue
    const role = msg.role

    if (role === 'system') {
      const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      if (text.trim().length > 0) systemParts.push(text.trim())
      continue
    }

    if (role === 'user') {
      const parts: GeminiPart[] = []
      if (typeof msg.content === 'string') {
        if (msg.content.length > 0) parts.push({ text: msg.content })
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (!part || typeof part !== 'object') continue
          if (part.type === 'text' && typeof part.text === 'string') {
            parts.push({ text: part.text })
          } else if (part.type === 'image_url' && part.image_url?.url) {
            const url = String(part.image_url.url)
            const match = url.match(/^data:([^;]+);base64,(.+)$/)
            if (match && match[1] && match[2]) {
              parts.push({
                inlineData: {
                  mimeType: match[1],
                  data: match[2],
                },
              })
            }
          }
        }
      }
      if (parts.length > 0) {
        contents.push({ role: 'user', parts })
      }
      continue
    }

    if (role === 'assistant') {
      const parts: GeminiPart[] = []
      if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          const fn = tc.function
          let args: Record<string, unknown> = {}
          try {
            args = typeof fn?.arguments === 'string' ? JSON.parse(fn.arguments) : (fn?.arguments || {})
          } catch {
            args = {}
          }
          parts.push({
            functionCall: {
              id: tc.id,
              name: fn?.name || 'function',
              args,
            },
          })
        }
      }
      if (typeof msg.content === 'string' && msg.content.length > 0) {
        parts.push({ text: msg.content })
      }
      if (parts.length > 0) {
        contents.push({ role: 'model', parts })
      }
      continue
    }

    if (role === 'tool') {
      const toolCallId = msg.tool_call_id || msg.name || 'tool'
      const toolName = msg.name || 'tool'
      const resultText = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              id: toolCallId,
              name: toolName,
              response: { result: resultText },
            },
          },
        ],
      })
      continue
    }
  }

  const system = systemParts.length > 0 ? systemParts.join('\n\n') : undefined
  return { system, contents }
}

function parseOpenAiTools(rawTools: any[] | undefined): FunctionToolDeclaration[] {
  if (!Array.isArray(rawTools)) return []
  const declarations: FunctionToolDeclaration[] = []
  for (const item of rawTools) {
    if (item?.type === 'function' && item.function?.name) {
      declarations.push({
        name: item.function.name,
        description: item.function.description || '',
        parameters: item.function.parameters || { type: 'object', properties: {} },
      })
    }
  }
  return declarations
}

const HOUR_MS = 60 * 60_000
const DAY_MS = 24 * HOUR_MS

export class AntigravityApiServer {
  private server: Server | null = null
  private status: ApiServerStatus = {
    running: false,
    host: '127.0.0.1',
    port: 18045,
  }

  constructor(
    private readonly session: AntigravitySession,
    private readonly store: AntigravityApiServerStore,
  ) {}

  /** Start times of accepted chat requests in the last 24 hours, oldest first. */
  private accepted: number[] = []

  getStatus(): ApiServerStatus {
    const now = Date.now()
    this.accepted = this.accepted.filter(at => at > now - DAY_MS)
    return {
      ...this.status,
      requestsLastHour: this.accepted.filter(at => at > now - HOUR_MS).length,
      requestsLastDay: this.accepted.length,
    }
  }

  /**
   * Count one chat request against the limits. Returns the seconds to wait when a limit is
   * reached; a refused request is not counted.
   */
  private admit(settings: ApiServerSettings, now = Date.now()): { window: 'hour' | 'day', retryAfter: number } | undefined {
    this.accepted = this.accepted.filter(at => at > now - DAY_MS)
    const lastHour = this.accepted.filter(at => at > now - HOUR_MS)
    if (settings.hourlyLimit > 0 && lastHour.length >= settings.hourlyLimit) {
      return { window: 'hour', retryAfter: Math.max(1, Math.ceil((lastHour[0]! + HOUR_MS - now) / 1000)) }
    }
    if (settings.dailyLimit > 0 && this.accepted.length >= settings.dailyLimit) {
      return { window: 'day', retryAfter: Math.max(1, Math.ceil((this.accepted[0]! + DAY_MS - now) / 1000)) }
    }
    this.accepted.push(now)
    return undefined
  }

  async start(): Promise<ApiServerStatus> {
    const settings = await this.store.read()
    if (!settings.enabled) {
      await this.stop()
      return this.getStatus()
    }

    if (this.server) {
      await this.stop()
    }

    // A hot reload starts the new plugin instance while the old one is still releasing the port.
    for (let attempt = 0; ; attempt++) {
      const status = await this.listen(settings)
      if (status.running || !/EADDRINUSE/.test(status.error ?? '') || attempt >= 5) return status
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  private listen(settings: ApiServerSettings): Promise<ApiServerStatus> {
    return new Promise(resolve => {
      const srv = createServer((req, res) => {
        void this.handleRequest(req, res, settings)
      })

      srv.once('error', (err: Error) => {
        this.status = {
          running: false,
          host: settings.host,
          port: settings.port,
          error: err.message,
        }
        resolve(this.getStatus())
      })

      srv.listen(settings.port, settings.host, () => {
        this.server = srv
        this.status = {
          running: true,
          host: settings.host,
          port: settings.port,
        }
        resolve(this.getStatus())
      })
    })
  }

  async stop(): Promise<void> {
    // A spare agy waits only for this server's requests.
    stopAgySpare()
    if (this.server) {
      const srv = this.server
      // close() alone waits for every keep-alive socket and open SSE stream, which can be forever.
      const closed = new Promise<void>(resolve => srv.close(() => resolve()))
      srv.closeIdleConnections()
      const force = setTimeout(() => srv.closeAllConnections(), 2_000)
      await closed
      clearTimeout(force)
      this.server = null
    }
    const settings = await this.store.read().catch(() => ({ host: '127.0.0.1', port: 18045 }))
    this.status = {
      running: false,
      host: settings.host,
      port: settings.port,
    }
  }

  private async getEffectiveEnabledModels(): Promise<PublicModelId[]> {
    try {
      const adv = await this.session.getAdvancedSettings()
      if (Array.isArray(adv?.enabledModels) && adv.enabledModels.length > 0) {
        return adv.enabledModels
      }
    } catch {}
    return ['gemini-3.8-flash']
  }

  private authenticate(req: IncomingMessage, configuredKey: string): boolean {
    if (!configuredKey || configuredKey.trim().length === 0) return true
    const authHeader = req.headers['authorization']
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i)
      if (match && match[1] === configuredKey) return true
    }
    const xApiKey = req.headers['x-api-key']
    if (xApiKey && xApiKey === configuredKey) return true
    return false
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse, settings: ApiServerSettings): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const pathname = url.pathname.replace(/\/+$/, '')

    if (pathname === '' || pathname === '/health') {
      const models = await this.getEffectiveEnabledModels()
      sendJson(res, 200, {
        status: 'ok',
        version: 'dsh-antigravity-oauth-api-server',
        models,
        // Quota of the Official CLI account, once the route has been used; `low` asks clients to slow down.
        ...lastAgyReading() === undefined ? {} : { agyStatus: lastAgyReading() },
      })
      return
    }

    if (!this.authenticate(req, settings.apiKey)) {
      sendError(res, 401, 'Incorrect API key provided.', 'invalid_request_error', 'invalid_api_key')
      return
    }

    if (req.method === 'GET' && pathname === '/v1/models') {
      const models = await this.getEffectiveEnabledModels()
      const data: OpenAiModelsResponse = {
        object: 'list',
        data: models.map(id => ({
          id,
          object: 'model',
          created: 1700000000,
          owned_by: 'antigravity',
        })),
      }
      sendJson(res, 200, data)
      return
    }

    if (req.method === 'POST' && pathname === '/v1/chat/completions') {
      await this.handleChatCompletions(req, res, settings)
      return
    }

    sendError(res, 404, `Not Found: ${req.method} ${pathname}`, 'invalid_request_error')
  }

  /**
   * Pull the first upstream event before any response header is sent, so a banned or rate-limited
   * account can still be swapped for another one. After the first event, the stream is committed.
   */
  private async openWithFailover(
    model: PublicModelId,
    input: ChatGenerateInput,
    first: { accountId: string, oauth: unknown, cca: { chat: (o: any, i: ChatGenerateInput, s: AbortSignal) => AsyncIterable<any> } },
    signal: AbortSignal,
  ): Promise<AsyncIterable<any>> {
    let lease = first
    for (let attempt = 0; ; attempt++) {
      const iterator = lease.cca.chat(lease.oauth, input, signal)[Symbol.asyncIterator]()
      try {
        const head = await iterator.next()
        return (async function* () {
          if (head.done) return
          yield head.value
          while (true) {
            const next = await iterator.next()
            if (next.done) return
            yield next.value
          }
        })()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const banned = isAccountBannedError(message)
        const limited = !banned && /\b429\b|RESOURCE_EXHAUSTED/i.test(message)
        if (banned) await this.session.noteBanned(lease.accountId)
        else if (limited) this.session.noteRateLimited(lease.accountId)
        if (!(banned || limited) || attempt >= 3 || signal.aborted) throw error
        const next = await this.session.acquire({ model })
        if (next === undefined || next.accountId === lease.accountId) throw error
        console.warn(`[dsh-antigravity-oauth] api-server: ${banned ? 'banned' : 'rate-limited'} account skipped, retrying on another`)
        lease = next
      }
    }
  }

  /** Official CLI route, mapped onto the event shape the response writers already consume. */
  private async *agyEvents(
    binary: string,
    model: PublicModelId,
    effort: ReasoningEffort,
    body: any,
    signal: AbortSignal,
    onActivity?: () => void,
    hints: AgyRequestHints = {},
  ): AsyncIterable<any> {
    const images: OpenAiImages = new Map()
    const request = openAiToRequest(body, images)
    // Like the DSH adapter: only images after the last assistant message travel; older ones were
    // answered already and become a placeholder, so one old bad image cannot block a conversation.
    let lastAssistant = -1
    request.messages.forEach((message, index) => { if (message.role === 'assistant') lastAssistant = index })
    const fresh = new Set<object>(request.messages.slice(lastAssistant + 1).flatMap(message => message.content.filter(block => block.type === 'image')))
    for await (const event of agyTurn({
      binary,
      workspace: agyWorkspace(String(this.session.store?.filename)),
      model,
      effort,
      request,
      signal,
      queueTimeoutMs: AGY_QUEUE_TIMEOUT_MS,
      maxUpstreamAttempts: AGY_MAX_UPSTREAM_ATTEMPTS,
      // API clients send short, self-contained requests; a started spare agy takes them.
      warm: true,
      ...hints,
      ...onActivity === undefined ? {} : { onActivity },
      loadImage: async block => {
        if (!fresh.has(block)) return `[Earlier image: ${block.attachment?.name ?? 'image'} (already answered)]`
        const image = images.get(block)
        if (image === undefined || typeof image === 'string') throw new AgyError(image ?? 'image data is missing', 'image-rejected')
        return image
      },
    })) {
      if (event.type === 'text') { yield { type: 'text', text: event.text }; continue }
      if (event.rejected.length > 0) console.warn(`[dsh-antigravity-oauth] api-server agy: ignored ${event.rejected.join(', ')}`)
      for (const call of event.calls) {
        yield { type: 'functionCall', id: `call_${randomUUID()}`, name: call.name, args: JSON.parse(call.arguments) as Record<string, unknown> }
      }
      if (event.usage !== undefined) {
        yield {
          type: 'usage',
          usage: {
            inputTokens: event.usage.input_tokens ?? 0,
            outputTokens: event.usage.output_tokens ?? 0,
            ...event.usage.thinking_tokens ? { reasoningTokens: event.usage.thinking_tokens } : {},
          },
        }
      }
      yield { type: 'finish', reason: 'STOP' }
    }
  }

  /** Gateway route: forward the OpenAI request as it is and relay the gateway's answer. */
  private async proxyToGateway(req: IncomingMessage, res: ServerResponse, settings: ManagerSettings, body: unknown): Promise<void> {
    if (settings.baseUrl.length === 0) {
      sendError(res, 503, 'No gateway URL is set in Antigravity settings.', 'server_error', 'gateway_not_configured')
      return
    }
    const abort = new AbortController()
    req.on('close', () => abort.abort())
    try {
      const upstream = await fetch(chatCompletionsUrl(settings.baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {} },
        body: JSON.stringify(body),
        signal: abort.signal,
      })
      res.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Access-Control-Allow-Origin': '*',
      })
      if (upstream.body !== null) for await (const chunk of upstream.body) res.write(chunk)
      res.end()
    } catch (err: unknown) {
      if (!res.headersSent) sendError(res, 502, `Gateway unreachable at ${settings.baseUrl}: ${(err as Error).message}`, 'upstream_error')
      else res.end()
    }
  }

  private async handleChatCompletions(req: IncomingMessage, res: ServerResponse, settings: ApiServerSettings): Promise<void> {
    let body: any
    try {
      body = await readBodyJson(req)
    } catch (err: unknown) {
      sendError(res, 400, (err as Error).message || 'Invalid JSON in request body')
      return
    }

    const modelName = body.model
    if (!modelName || typeof modelName !== 'string') {
      sendError(res, 400, 'Missing or invalid "model" parameter.')
      return
    }

    const enabledModels = await this.getEffectiveEnabledModels()
    // Accept OpenAI-style effort suffixes (`gemini-3.8-flash-low`) as well as the bare id.
    const suffixed = /^(.+)-(low|medium|high)$/.exec(modelName)
    const baseModel = suffixed !== null && enabledModels.includes(suffixed[1] as PublicModelId) ? suffixed[1]! : modelName
    const requestedEffort = suffixed !== null && baseModel === suffixed[1]
      ? suffixed[2]
      : typeof body.reasoning_effort === 'string' && isReasoningEffort(body.reasoning_effort) ? body.reasoning_effort : undefined
    if (!isPublicModelId(baseModel) || !enabledModels.includes(baseModel as PublicModelId)) {
      sendError(res, 400, `The model '${modelName}' does not exist or is not enabled in Antigravity settings.`, 'invalid_request_error', 'model_not_found')
      return
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      sendError(res, 400, 'Missing or empty "messages" parameter.')
      return
    }

    const refused = this.admit(settings)
    if (refused !== undefined) {
      const limit = refused.window === 'hour' ? `${settings.hourlyLimit} requests per hour` : `${settings.dailyLimit} requests per day`
      sendError(res, 429, `This endpoint accepts ${limit} (set on the API Server tab). Try again in ${refused.retryAfter} s.`, 'rate_limit_error', 'rate_limit_exceeded', refused.retryAfter)
      return
    }

    const publicId = baseModel as PublicModelId
    const { system, contents } = parseOpenAiMessages(body.messages)
    const functions = parseOpenAiTools(body.tools)

    let adv: any
    try {
      adv = await this.session.getAdvancedSettings()
    } catch {}

    const effort = (requestedEffort ?? adv?.defaultReasoningEffort ?? 'medium') as ReasoningEffort
    const wireModel = routeChatModel(publicId, effort)
    const thinkingLevel = thinkingLevelFor(publicId, effort)

    const input: ChatGenerateInput = {
      kind: 'chat',
      model: wireModel,
      contents,
      ...(system ? { system } : {}),
      functions,
      ...(thinkingLevel ? { thinkingLevel } : {}),
    }

    // Follow the route chosen in Settings, so other apps use the same path as DSH chats.
    const routeSettings = await this.session.manager?.read().catch(() => undefined)
    const route = routeSettings?.route ?? 'direct'
    console.info(`[dsh-antigravity-oauth] api-server route=${route} model=${publicId} effort=${effort}`)
    if (routeSettings !== undefined && route === 'gateway') {
      await this.proxyToGateway(req, res, routeSettings, { ...body, model: wireModel })
      return
    }
    const viaAgy = routeSettings !== undefined && route === 'agy'

    let lease: any
    try {
      if (!viaAgy) lease = await this.session.acquire({ model: publicId })
    } catch (err: unknown) {
      sendError(res, 503, `Failed to acquire Antigravity account: ${(err as Error).message}`, 'server_error', 'account_acquire_failed')
      return
    }

    if (!viaAgy && !lease) {
      sendError(res, 503, 'No available Antigravity account. Please sign in via DSH settings.', 'server_error', 'no_available_account')
      return
    }

    // A client that gave up must not keep a model call (or a place in the agy queue) alive. The
    // request's own `close` fires as soon as the body is read, so the response is what to watch.
    const abortController = new AbortController()
    if (res.destroyed || req.socket.destroyed) abortController.abort()
    res.on('close', () => {
      if (!res.writableFinished) abortController.abort()
    })
    let timedOut = false
    let started = false
    const expire = (): void => {
      timedOut = true
      abortController.abort()
    }
    let deadline = setTimeout(expire, FIRST_EVENT_DEADLINE_MS)
    // Progress before the first event restarts the deadline; after it, the stream is on its own.
    const touch = (): void => {
      if (started) return
      clearTimeout(deadline)
      deadline = setTimeout(expire, FIRST_EVENT_DEADLINE_MS)
    }

    const isStream = Boolean(body.stream)
    const requestId = randomUUID()
    const createdTime = Math.floor(Date.now() / 1000)
    const startedAt = Date.now()

    try {
      const source: AsyncIterable<any> = viaAgy
        ? this.agyEvents(routeSettings.agyPath, publicId, effort, body, abortController.signal, touch, agyHintsOf(req.headers, startedAt))
        : await this.openWithFailover(publicId, input, lease, abortController.signal)
      // Read the first event before any header goes out, so a failure still gets an HTTP status.
      const iterator = source[Symbol.asyncIterator]()
      const head = await iterator.next()
      started = true
      clearTimeout(deadline)
      const ccaStream = resume(head, iterator)

      if (isStream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        })

        res.write(`data: ${JSON.stringify({
          id: `chatcmpl-${requestId}`,
          object: 'chat.completion.chunk',
          created: createdTime,
          model: modelName,
          choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
        })}\n\n`)

        let toolIndex = 0
        for await (const event of ccaStream) {
          if (event.type === 'thought') {
            res.write(`data: ${JSON.stringify({
              id: `chatcmpl-${requestId}`,
              object: 'chat.completion.chunk',
              created: createdTime,
              model: modelName,
              choices: [{ index: 0, delta: { reasoning_content: event.text }, finish_reason: null }],
            })}\n\n`)
          } else if (event.type === 'text') {
            res.write(`data: ${JSON.stringify({
              id: `chatcmpl-${requestId}`,
              object: 'chat.completion.chunk',
              created: createdTime,
              model: modelName,
              choices: [{ index: 0, delta: { content: event.text }, finish_reason: null }],
            })}\n\n`)
          } else if (event.type === 'functionCall') {
            res.write(`data: ${JSON.stringify({
              id: `chatcmpl-${requestId}`,
              object: 'chat.completion.chunk',
              created: createdTime,
              model: modelName,
              choices: [{
                index: 0,
                delta: {
                  tool_calls: [{
                    index: toolIndex++,
                    id: event.id || `call_${Date.now()}`,
                    type: 'function',
                    function: {
                      name: event.name,
                      arguments: JSON.stringify(event.args),
                    },
                  }],
                },
                finish_reason: null,
              }],
            })}\n\n`)
          } else if (event.type === 'finish') {
            res.write(`data: ${JSON.stringify({
              id: `chatcmpl-${requestId}`,
              object: 'chat.completion.chunk',
              created: createdTime,
              model: modelName,
              choices: [{ index: 0, delta: {}, finish_reason: toolIndex > 0 ? 'tool_calls' : 'stop' }],
            })}\n\n`)
          }
        }

        res.write('data: [DONE]\n\n')
        res.end()
      } else {
        let content = ''
        let reasoningContent = ''
        const toolCalls: any[] = []
        let lastUsage: any

        for await (const event of ccaStream) {
          if (event.type === 'text') content += event.text
          else if (event.type === 'thought') reasoningContent += event.text
          else if (event.type === 'functionCall') {
            toolCalls.push({
              id: event.id || `call_${Date.now()}`,
              type: 'function',
              function: {
                name: event.name,
                arguments: JSON.stringify(event.args),
              },
            })
          } else if (event.type === 'usage') {
            lastUsage = event.usage
          }
        }

        sendJson(res, 200, {
          id: `chatcmpl-${requestId}`,
          object: 'chat.completion',
          created: createdTime,
          model: modelName,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: content.trimEnd(),
                ...(reasoningContent.length > 0 ? { reasoning_content: reasoningContent } : {}),
                ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
              },
              finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
            },
          ],
          usage: {
            prompt_tokens: lastUsage?.inputTokens || 0,
            completion_tokens: lastUsage?.outputTokens || 0,
            total_tokens: (lastUsage?.inputTokens || 0) + (lastUsage?.outputTokens || 0),
            ...(lastUsage?.reasoningTokens ? { completion_tokens_details: { reasoning_tokens: lastUsage.reasoningTokens } } : {}),
          },
        })
      }
    } catch (err: unknown) {
      clearTimeout(deadline)
      if (res.destroyed) return
      const failure = httpFailureOf(err, timedOut)
      console.warn(`[dsh-antigravity-oauth] api-server route=${route} failed after ${Date.now() - startedAt} ms: ${failure.status} ${failure.code ?? failure.type}: ${failure.message.slice(0, 300)}`)
      if (!res.headersSent) {
        sendError(res, failure.status, failure.message, failure.type, failure.code, failure.retryAfter)
      } else {
        // The stream is already open: say why it stops instead of ending it silently.
        if (isStream) res.write(`data: ${JSON.stringify({ error: { message: failure.message, type: failure.type, ...failure.code ? { code: failure.code } : {} } })}\n\n`)
        res.end()
      }
    } finally {
      started = true
      clearTimeout(deadline)
    }
  }
}
