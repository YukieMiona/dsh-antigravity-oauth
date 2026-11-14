import {
  CONTEXT_WINDOW_EXCEEDED_CODE,
  LlmError,
  ToolCallId,
  isContextWindowExceededError,
} from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { resolveImageBlock, type ImageAccessResolver } from '../image-input.ts'
import { isDroppedToolName } from '../native-tools.ts'
import { chatCompletionsUrl, type ManagerSettings } from './store.ts'

type TextPart = { type: 'text', text: string }
type ImageUrlPart = { type: 'image_url', image_url: { url: string } }

export type BridgeToolCall = { id: string, type: 'function', function: { name: string, arguments: string } }

export type BridgeMessage =
  | { role: 'system', content: string }
  | { role: 'user', content: string | (TextPart | ImageUrlPart)[] }
  | { role: 'assistant', content: string | null, tool_calls?: BridgeToolCall[] }
  | { role: 'tool', tool_call_id: string, content: string }

export type BridgeTool = {
  type: 'function'
  function: { name: string, description: string, parameters: Record<string, unknown> }
}

export interface BridgeRequest {
  model: string
  messages: BridgeMessage[]
  stream: true
  stream_options: { include_usage: true }
  max_tokens?: number
  temperature?: number
  stop?: string[]
  tools?: BridgeTool[]
}

type ImageBlock = Extract<ContentBlock, { type: 'image' }>

function textOf(blocks: readonly ContentBlock[]): string {
  return blocks.filter(b => b.type === 'text').map(b => b.text).join('')
}

function imageName(block: ImageBlock): string {
  return block.attachment?.name || block.attachment?.attachmentId || 'image'
}

/**
 * Only images in the newest user turn and the trailing tool results travel as bytes. Older ones
 * become placeholders: the gateway re-uploads every image on every request, and history images
 * would otherwise grow each turn's payload without bound.
 */
function freshImages(messages: GenerateOptions['messages']): ReadonlySet<ImageBlock> {
  const fresh = new Set<ImageBlock>()
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if (msg.role === 'tool') {
      for (const b of msg.content) if (b.type === 'image' && b.offloaded !== true) fresh.add(b)
      continue
    }
    if (msg.role === 'user') {
      for (const b of msg.content) if (b.type === 'image' && b.offloaded !== true) fresh.add(b)
    }
    if (msg.role !== 'developer') break
  }
  return fresh
}

interface ConvertContext {
  fresh: ReadonlySet<ImageBlock>
  attachments?: AttachmentStore
  signal?: AbortSignal
  resolveAccess?: ImageAccessResolver
  allowImages: boolean
}

async function imagePart(block: ImageBlock, ctx: ConvertContext): Promise<TextPart | ImageUrlPart> {
  if (!ctx.allowImages) return { type: 'text', text: `[Image: ${imageName(block)} (image input disabled)]` }
  if (block.offloaded !== true && !ctx.fresh.has(block)) {
    return { type: 'text', text: `[Historical image: ${imageName(block)} (omitted to preserve context)]` }
  }
  const image = await resolveImageBlock(block, ctx.attachments, ctx.signal, ctx.resolveAccess)
  return image.type === 'inline'
    ? { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }
    : { type: 'text', text: image.text }
}

async function userContent(blocks: readonly ContentBlock[], ctx: ConvertContext): Promise<string | (TextPart | ImageUrlPart)[]> {
  const parts: (TextPart | ImageUrlPart)[] = []
  for (const block of blocks) {
    if (block.type === 'text' && block.text.length > 0) parts.push({ type: 'text', text: block.text })
    else if (block.type === 'image') parts.push(await imagePart(block, ctx))
  }
  if (parts.every(p => p.type === 'text')) return parts.map(p => (p as TextPart).text).join('')
  return parts
}

/** OpenAI tool messages are text only, so tool-result images degrade to their placeholder text. */
async function toolResultText(blocks: readonly ContentBlock[], ctx: ConvertContext): Promise<string> {
  const pieces: string[] = []
  for (const block of blocks) {
    if (block.type === 'text' && block.text.length > 0) pieces.push(block.text)
    else if (block.type === 'image') {
      if (block.offloaded === true) {
        const placeholder = await resolveImageBlock(block, ctx.attachments, ctx.signal, ctx.resolveAccess)
        pieces.push(placeholder.type === 'placeholder' ? placeholder.text : `[Image: ${imageName(block)}]`)
      } else {
        pieces.push(`[Image result: ${imageName(block)} (not forwarded through the bridge)]`)
      }
    }
  }
  return pieces.join('\n')
}

/**
 * Translate a DSH request history into OpenAI chat messages.
 *
 * Tool-call ids are made unique (replayed compaction shadows can repeat one), and a tool result
 * whose call is no longer in the history becomes plain user text so the payload stays legal.
 */
export async function toBridgeMessages(
  options: Pick<GenerateOptions, 'messages' | 'system' | 'signal'>,
  io: { attachments?: AttachmentStore, resolveAccess?: ImageAccessResolver, allowImages?: boolean } = {},
): Promise<BridgeMessage[]> {
  const ctx: ConvertContext = {
    fresh: freshImages(options.messages),
    attachments: io.attachments,
    signal: options.signal,
    resolveAccess: io.resolveAccess,
    allowImages: io.allowImages !== false,
  }
  const out: BridgeMessage[] = []
  const systemTexts: string[] = []
  if (options.system !== undefined && options.system.trim().length > 0) systemTexts.push(options.system.trim())

  const emitted = new Map<string, number>()
  const pending = new Map<string, string[]>()

  for (const message of options.messages) {
    if (message.role === 'system') {
      const text = textOf(message.content).trim()
      if (text.length > 0) systemTexts.push(text)
      continue
    }
    if (message.role === 'user') {
      const content = await userContent(message.content, ctx)
      if (content.length > 0) out.push({ role: 'user', content })
      continue
    }
    if (message.role === 'assistant') {
      const text = textOf(message.content)
      const calls: BridgeToolCall[] = []
      for (const block of message.content) {
        if (block.type !== 'tool-call') continue
        const seen = emitted.get(block.id) ?? 0
        emitted.set(block.id, seen + 1)
        const id = seen === 0 ? block.id : `${block.id}#${seen}`
        const queue = pending.get(block.id)
        if (queue === undefined) pending.set(block.id, [id])
        else queue.push(id)
        calls.push({ id, type: 'function', function: { name: block.name, arguments: block.arguments || '{}' } })
      }
      if (calls.length > 0) out.push({ role: 'assistant', content: text.length > 0 ? text : null, tool_calls: calls })
      else if (text.length > 0) out.push({ role: 'assistant', content: text })
      continue
    }
    if (message.role === 'tool') {
      const text = await toolResultText(message.content, ctx)
      const id = pending.get(message.toolCallId)?.shift()
      if (id === undefined) {
        if (text.length > 0) out.push({ role: 'user', content: `[Tool result]\n${text}` })
        continue
      }
      out.push({ role: 'tool', tool_call_id: id, content: message.isError === true ? `[error] ${text}` : text })
    }
    // Developer messages carry tool additions/removals; the request's `tools` already reflects them.
  }

  // Every tool call must be answered before the next turn, or OpenAI-style gateways reject the request.
  const answered = new Set(out.flatMap(m => m.role === 'tool' ? [m.tool_call_id] : []))
  for (let i = 0; i < out.length; i++) {
    const m = out[i]!
    if (m.role !== 'assistant' || m.tool_calls === undefined) continue
    const missing = m.tool_calls.filter(c => !answered.has(c.id))
    let insertAt = i + 1
    while (insertAt < out.length && out[insertAt]!.role === 'tool') insertAt++
    for (const call of missing) {
      out.splice(insertAt++, 0, { role: 'tool', tool_call_id: call.id, content: '[no result recorded]' })
      answered.add(call.id)
    }
  }

  const system: BridgeMessage[] = systemTexts.length > 0 ? [{ role: 'system', content: systemTexts.join('\n\n') }] : []
  const result = [...system, ...out]
  if (!result.some(m => m.role === 'user')) result.push({ role: 'user', content: 'Continue.' })
  return result
}

export function toBridgeTools(tools: GenerateOptions['tools']): BridgeTool[] {
  return (tools ?? [])
    .filter(tool => !isDroppedToolName(tool.name))
    .map(tool => ({
      type: 'function',
      function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    }))
}

// ---------------------------------------------------------------------------------------------
// Streaming

type ChunkDelta = {
  content?: string | null
  reasoning_content?: string | null
  reasoning?: string | null
  tool_calls?: { index?: number, id?: string, function?: { name?: string, arguments?: string } }[]
}

type CompletionChunk = {
  choices?: { delta?: ChunkDelta, finish_reason?: string | null }[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number }
    completion_tokens_details?: { reasoning_tokens?: number }
  }
  error?: { message?: string, code?: string | number, type?: string }
}

function usageOf(raw: NonNullable<CompletionChunk['usage']>): TokenUsage {
  const cached = raw.prompt_tokens_details?.cached_tokens ?? 0
  const reasoning = raw.completion_tokens_details?.reasoning_tokens ?? 0
  return {
    inputTokens: Math.max(0, (raw.prompt_tokens ?? 0) - cached),
    outputTokens: raw.completion_tokens ?? 0,
    ...cached > 0 ? { cacheReadTokens: cached } : {},
    ...reasoning > 0 ? { reasoningTokens: reasoning } : {},
  }
}

/** Errors before the first visible byte that are worth one more try at the gateway. */
export function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || status === 529
}

export function errorCodeFor(status: number, detail: string): string {
  if (isContextWindowExceededError(detail)) return CONTEXT_WINDOW_EXCEEDED_CODE
  if (status === 401 || status === 403) return 'AUTH'
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(detail)) return 'RATE_LIMIT'
  if (status >= 500) return 'SERVER'
  return 'UNKNOWN'
}

class BridgeHttpError extends Error {
  constructor(readonly status: number, readonly detail: string) {
    super(`Antigravity Manager returned HTTP ${status}: ${detail.slice(0, 500)}`)
  }
}

/**
 * Converts the gateway's SSE stream into DSH stream chunks with complete block lifecycles:
 * every block opened with `block-start` is closed with a `block-end` carrying the assembled block.
 */
export class BridgeStreamAssembler {
  private index = 0
  private open: { kind: 'text' | 'reasoning', text: string } | undefined
  private tool: { openaiIndex: number, id: string, name: string, args: string } | undefined
  private toolCount = 0
  usage: TokenUsage | undefined
  finishReason: string | undefined
  visible = false;

  *delta(delta: ChunkDelta): Generator<StreamChunk> {
    const thought = delta.reasoning_content ?? delta.reasoning
    if (typeof thought === 'string' && thought.length > 0) yield* this.appendText('reasoning', thought)
    if (typeof delta.content === 'string' && delta.content.length > 0) yield* this.appendText('text', delta.content)
    for (const call of delta.tool_calls ?? []) yield* this.appendTool(call)
  }

  private *appendText(kind: 'text' | 'reasoning', text: string): Generator<StreamChunk> {
    if (this.open?.kind !== kind) {
      yield* this.closeAll()
      this.open = { kind, text: '' }
      yield { type: 'block-start', index: this.index, blockType: kind }
    }
    this.open!.text += text
    this.visible = true
    yield kind === 'text'
      ? { type: 'text-delta', index: this.index, text }
      : { type: 'reasoning-delta', index: this.index, text }
  }

  private *appendTool(call: NonNullable<ChunkDelta['tool_calls']>[number]): Generator<StreamChunk> {
    const openaiIndex = call.index ?? 0
    if (this.tool === undefined || this.tool.openaiIndex !== openaiIndex || (call.id && call.id !== this.tool.id)) {
      yield* this.closeAll()
      const id = call.id && call.id.length > 0 ? call.id : `call_bridge_${Date.now().toString(36)}_${this.toolCount}`
      this.tool = { openaiIndex, id, name: call.function?.name ?? '', args: '' }
      this.toolCount += 1
      yield { type: 'block-start', index: this.index, blockType: 'tool-call' }
    } else if (call.function?.name && this.tool.name.length === 0) {
      this.tool.name = call.function.name
    }
    const argsDelta = call.function?.arguments ?? ''
    this.tool.args += argsDelta
    this.visible = true
    yield {
      type: 'tool-call-delta',
      index: this.index,
      id: ToolCallId(this.tool.id),
      ...this.tool.name.length > 0 ? { name: this.tool.name } : {},
      argumentsDelta: argsDelta,
    }
  }

  *closeAll(): Generator<StreamChunk> {
    if (this.open !== undefined) {
      yield { type: 'block-end', index: this.index, block: { type: this.open.kind, text: this.open.text } }
      this.index += 1
      this.open = undefined
    }
    if (this.tool !== undefined) {
      yield {
        type: 'block-end',
        index: this.index,
        block: {
          type: 'tool-call',
          id: ToolCallId(this.tool.id),
          name: this.tool.name || 'unknown_tool',
          arguments: this.tool.args.length > 0 ? this.tool.args : '{}',
        },
      }
      this.index += 1
      this.tool = undefined
    }
  }

  *finish(model: string): Generator<StreamChunk> {
    yield* this.closeAll()
    if (this.usage !== undefined) yield { type: 'usage', usage: this.usage }
    if (this.toolCount > 0 || this.finishReason === 'tool_calls') {
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
    } else if (this.finishReason === 'length') {
      yield { type: 'finish', reason: { kind: 'max-tokens' } }
    } else if (!this.visible) {
      yield {
        type: 'finish',
        reason: {
          kind: 'error',
          failure: { message: `model "${model}" returned a completed response with no content`, code: 'EMPTY_RESPONSE' },
        },
      }
    } else {
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
}

async function* sseData(body: ReadableStream<Uint8Array>, onBytes: () => void): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      onBytes()
      buffer += decoder.decode(value, { stream: true })
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '')
        buffer = buffer.slice(newline + 1)
        if (line.startsWith('data:')) yield line.slice(5).trimStart()
      }
    }
    const tail = buffer.trim()
    if (tail.startsWith('data:')) yield tail.slice(5).trimStart()
  } finally {
    reader.releaseLock()
  }
}

export interface BridgeStreamOptions {
  settings: ManagerSettings
  request: BridgeRequest
  signal: AbortSignal
  /** Called on every received byte so an idle watchdog can restart. */
  onActivity: () => void
  fetchImpl?: typeof fetch
  /** Delays between retries of a gateway 5xx that arrived before any output. */
  retryDelaysMs?: readonly number[]
}

const DEFAULT_RETRY_DELAYS_MS = [1_500, 4_000] as const

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, ms)
    const onAbort = (): void => { clearTimeout(timer); reject(signal.reason) }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function openStream(options: BridgeStreamOptions): Promise<ReadableStream<Uint8Array>> {
  const fetchImpl = options.fetchImpl ?? fetch
  const delays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'text/event-stream' }
  if (options.settings.apiKey) headers.authorization = `Bearer ${options.settings.apiKey}`
  const body = JSON.stringify(options.request)
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(chatCompletionsUrl(options.settings.baseUrl), {
      method: 'POST', headers, body, signal: options.signal,
    })
    options.onActivity()
    if (res.ok && res.body !== null) return res.body
    const detail = await res.text().catch(() => '')
    if (res.ok) throw new BridgeHttpError(502, 'empty response body')
    if (isRetryableStatus(res.status) && attempt < delays.length) {
      await sleep(delays[attempt]!, options.signal)
      continue
    }
    throw new BridgeHttpError(res.status, detail || res.statusText)
  }
}

/** Stream one chat completion through the gateway as DSH chunks. */
export async function* streamBridge(options: BridgeStreamOptions): AsyncGenerator<StreamChunk> {
  const assembler = new BridgeStreamAssembler()
  try {
    const body = await openStream(options)
    for await (const data of sseData(body, options.onActivity)) {
      if (data === '[DONE]') break
      let chunk: CompletionChunk
      try { chunk = JSON.parse(data) as CompletionChunk } catch { continue }
      if (chunk.error !== undefined) {
        const status = Number(chunk.error.code)
        throw new BridgeHttpError(Number.isInteger(status) && status >= 400 ? status : 502, chunk.error.message ?? JSON.stringify(chunk.error))
      }
      if (chunk.usage) assembler.usage = usageOf(chunk.usage)
      const choice = chunk.choices?.[0]
      if (choice?.delta) yield* assembler.delta(choice.delta)
      if (choice?.finish_reason) assembler.finishReason = choice.finish_reason
    }
  } catch (error) {
    if (error instanceof BridgeHttpError) {
      throw new LlmError(error.message, errorCodeFor(error.status, error.detail), { cause: error })
    }
    if (options.signal.aborted) throw error
    const message = error instanceof Error
      ? (error.cause instanceof Error ? `${error.message}: ${error.cause.message}` : error.message)
      : String(error)
    throw new LlmError(
      `Antigravity Manager is unreachable at ${options.settings.baseUrl} (${message}). `
        + 'Start the gateway or turn off the bridge in Settings → Antigravity.',
      'TRANSPORT',
      { cause: error },
    )
  }
  yield* assembler.finish(options.request.model)
}
