import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { isPublicModelId, isReasoningEffort, publicModel, routeChatModel, thinkingLevelFor } from '../models.ts'
import { isAccountBannedError } from '../ban.ts'
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

function sendError(res: ServerResponse, status: number, message: string, type = 'invalid_request_error', code?: string): void {
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

  getStatus(): ApiServerStatus {
    return { ...this.status }
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
      await this.handleChatCompletions(req, res)
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

  private async handleChatCompletions(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

    let lease: any
    try {
      lease = await this.session.acquire({ model: publicId })
    } catch (err: unknown) {
      sendError(res, 503, `Failed to acquire Antigravity account: ${(err as Error).message}`, 'server_error', 'account_acquire_failed')
      return
    }

    if (!lease) {
      sendError(res, 503, 'No available Antigravity account. Please sign in via DSH settings.', 'server_error', 'no_available_account')
      return
    }

    const abortController = new AbortController()
    req.on('close', () => {
      abortController.abort()
    })

    const isStream = Boolean(body.stream)
    const requestId = randomUUID()
    const createdTime = Math.floor(Date.now() / 1000)

    try {
      const ccaStream = await this.openWithFailover(publicId, input, lease, abortController.signal)

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
                    index: 0,
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
              choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
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
                content,
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
          },
        })
      }
    } catch (err: unknown) {
      if (!res.headersSent) {
        sendError(res, 500, (err as Error).message || 'Upstream CCA generation error', 'upstream_error')
      } else {
        res.end()
      }
    }
  }
}
