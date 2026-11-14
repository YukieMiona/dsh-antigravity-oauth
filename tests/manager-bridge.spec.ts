import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAntigravityAdapter } from '../src/adapter.ts'
import {
  BridgeStreamAssembler,
  streamBridge,
  toBridgeMessages,
  toBridgeTools,
  type BridgeRequest,
} from '../src/manager/bridge.ts'
import { probeBridge } from '../src/manager/probe.ts'
import { AntigravityManagerStore, normalizeBaseUrl, viewOf } from '../src/manager/store.ts'

const settings = { enabled: true, baseUrl: 'http://127.0.0.1:8045/v1', apiKey: 'sk-fixture-key' }

function msg(role: string, content: unknown[], extra: Record<string, unknown> = {}) {
  return { id: `${role}-${Math.random()}`, role, source: { kind: role }, content, ...extra }
}

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const out: StreamChunk[] = []
  for await (const chunk of stream) out.push(chunk)
  return out
}

function sse(...events: unknown[]): Response {
  const body = events.map(e => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join('')
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function request(): BridgeRequest {
  return { model: 'gemini-3.8-flash-low', messages: [{ role: 'user', content: 'hi' }], stream: true, stream_options: { include_usage: true } }
}

describe('AntigravityManagerStore', () => {
  let dir: string | undefined
  afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); dir = undefined })

  it('defaults to off with no key, and never ships a key in source defaults', async () => {
    dir = await mkdtemp(join(tmpdir(), 'agy-mgr-'))
    const store = new AntigravityManagerStore(join(dir, 'm.json'))
    expect(await store.read()).toEqual({ enabled: false, baseUrl: 'http://127.0.0.1:8045/v1', apiKey: '' })
  })

  it('merges patches: omitted key is kept, empty key clears, file is private', async () => {
    dir = await mkdtemp(join(tmpdir(), 'agy-mgr-'))
    const file = join(dir, 'm.json')
    const store = new AntigravityManagerStore(file)
    await store.save({ apiKey: 'sk-secret-1234', baseUrl: 'http://127.0.0.1:8045/v1/' })
    expect(await store.save({ enabled: true })).toEqual({ enabled: true, baseUrl: 'http://127.0.0.1:8045/v1', apiKey: 'sk-secret-1234' })
    expect((await stat(file)).mode & 0o777).toBe(0o600)
    expect((await store.save({ apiKey: '' })).apiKey).toBe('')
    expect(JSON.parse(await readFile(file, 'utf8')).enabled).toBe(true)
  })

  it('rejects unsafe gateway URLs and masks the key in the UI view', () => {
    expect(() => normalizeBaseUrl('ftp://host/v1')).toThrow()
    expect(() => normalizeBaseUrl('http://user:pw@host/v1')).toThrow()
    expect(normalizeBaseUrl('http://127.0.0.1:8045/v1//')).toBe('http://127.0.0.1:8045/v1')
    const view = viewOf({ ...settings, apiKey: 'sk-abcdefgh1234' })
    expect(view).toEqual({ enabled: true, baseUrl: settings.baseUrl, hasApiKey: true, apiKeyHint: '…1234' })
    expect(JSON.stringify(view)).not.toContain('abcdefgh')
  })
})

describe('toBridgeMessages', () => {
  it('maps system, tool calls and tool results into OpenAI chat messages', async () => {
    const out = await toBridgeMessages({
      system: 'one-shot system',
      messages: [
        msg('system', [{ type: 'text', text: 'loop system' }]),
        msg('user', [{ type: 'text', text: 'read it' }]),
        msg('assistant', [{ type: 'reasoning', text: 'hidden' }, { type: 'tool-call', id: 'c1', name: 'read_file', arguments: '{"p":1}' }]),
        msg('tool', [{ type: 'text', text: 'file body' }], { toolCallId: 'c1' }),
        msg('assistant', [{ type: 'text', text: 'done' }]),
      ],
    } as unknown as GenerateOptions)
    expect(out).toEqual([
      { role: 'system', content: 'one-shot system\n\nloop system' },
      { role: 'user', content: 'read it' },
      { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{"p":1}' } }] },
      { role: 'tool', tool_call_id: 'c1', content: 'file body' },
      { role: 'assistant', content: 'done' },
    ])
  })

  it('keeps payloads legal: unique repeated ids, orphan results as text, unanswered calls filled', async () => {
    const call = { type: 'tool-call', id: 'dup', name: 't', arguments: '' }
    const out = await toBridgeMessages({
      messages: [
        msg('user', [{ type: 'text', text: 'go' }]),
        msg('tool', [{ type: 'text', text: 'stale' }], { toolCallId: 'gone' }),
        msg('assistant', [call]),
        msg('tool', [{ type: 'text', text: 'r1' }], { toolCallId: 'dup' }),
        msg('assistant', [call]),
      ],
    } as unknown as GenerateOptions)
    expect(out[1]).toEqual({ role: 'user', content: '[Tool result]\nstale' })
    const ids = out.flatMap(m => m.role === 'assistant' ? (m.tool_calls ?? []).map(c => c.id) : [])
    expect(ids).toEqual(['dup', 'dup#1'])
    expect(out.at(-1)).toEqual({ role: 'tool', tool_call_id: 'dup#1', content: '[no result recorded]' })
    expect((out[2] as { tool_calls: { function: { arguments: string } }[] }).tool_calls[0]!.function.arguments).toBe('{}')
  })

  it('drops dropped tools and passes schemas through', () => {
    expect(toBridgeTools([
      { name: 'generate_image', description: 'x', parameters: {} },
      { name: 'read_file', description: 'r', parameters: { type: 'object' } },
    ])).toEqual([{ type: 'function', function: { name: 'read_file', description: 'r', parameters: { type: 'object' } } }])
  })
})

describe('BridgeStreamAssembler', () => {
  it('assembles fragmented tool-call arguments into one closed block', () => {
    const a = new BridgeStreamAssembler()
    const chunks = [
      ...a.delta({ reasoning_content: 'think' }),
      ...a.delta({ tool_calls: [{ index: 0, id: 'call_1', function: { name: 'get', arguments: '{"ci' } }] }),
      ...a.delta({ tool_calls: [{ index: 0, function: { arguments: 'ty":"P"}' } }] }),
      ...a.finish('m'),
    ]
    expect(chunks.filter(c => c.type === 'block-start').map(c => (c as { blockType: string }).blockType)).toEqual(['reasoning', 'tool-call'])
    const ends = chunks.filter(c => c.type === 'block-end').map(c => (c as { block: unknown }).block)
    expect(ends).toEqual([
      { type: 'reasoning', text: 'think' },
      { type: 'tool-call', id: 'call_1', name: 'get', arguments: '{"city":"P"}' },
    ])
    expect(chunks.at(-1)).toEqual({ type: 'finish', reason: { kind: 'tool-calls' } })
  })

  it('reports length as max-tokens and an empty answer as an error finish', () => {
    const a = new BridgeStreamAssembler()
    a.finishReason = 'length'
    expect([...a.delta({ content: 'x' }), ...a.finish('m')].at(-1)).toEqual({ type: 'finish', reason: { kind: 'max-tokens' } })
    const empty = [...new BridgeStreamAssembler().finish('m')].at(-1) as { reason: { kind: string, failure: { code: string } } }
    expect(empty.reason.kind).toBe('error')
    expect(empty.reason.failure.code).toBe('EMPTY_RESPONSE')
  })
})

describe('streamBridge', () => {
  it('streams text and usage, sending the bearer key to chat/completions', async () => {
    const fetchImpl = vi.fn(async () => sse(
      { choices: [{ delta: { content: 'Hel' } }] },
      { choices: [{ delta: { content: 'lo' }, finish_reason: 'stop' }] },
      { choices: [], usage: { prompt_tokens: 10, completion_tokens: 2, prompt_tokens_details: { cached_tokens: 4 } } },
      '[DONE]',
    ))
    const chunks = await collect(streamBridge({ settings, request: request(), signal: new AbortController().signal, onActivity() {}, fetchImpl: fetchImpl as unknown as typeof fetch }))
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:8045/v1/chat/completions')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-fixture-key')
    expect(chunks).toContainEqual({ type: 'block-end', index: 0, block: { type: 'text', text: 'Hello' } })
    expect(chunks).toContainEqual({ type: 'usage', usage: { inputTokens: 6, outputTokens: 2, cacheReadTokens: 4 } })
    expect(chunks.at(-1)).toEqual({ type: 'finish', reason: { kind: 'stop' } })
  })

  it('retries a gateway 503 before output, then succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('capacity', { status: 503 }))
      .mockResolvedValueOnce(sse({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }))
    const chunks = await collect(streamBridge({ settings, request: request(), signal: new AbortController().signal, onActivity() {}, fetchImpl, retryDelaysMs: [0] }))
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(chunks.at(-1)).toEqual({ type: 'finish', reason: { kind: 'stop' } })
  })

  it('maps auth failures, in-stream errors and unreachable gateways to LlmError codes', async () => {
    const run = (fetchImpl: unknown) => collect(streamBridge({ settings, request: request(), signal: new AbortController().signal, onActivity() {}, fetchImpl: fetchImpl as typeof fetch, retryDelaysMs: [] }))
    await expect(run(async () => new Response('bad key', { status: 401 }))).rejects.toMatchObject({ code: 'AUTH' })
    await expect(run(async () => sse({ error: { code: 429, message: 'RESOURCE_EXHAUSTED' } }))).rejects.toMatchObject({ code: 'RATE_LIMIT' })
    await expect(run(async () => { throw new TypeError('fetch failed') })).rejects.toMatchObject({ code: 'TRANSPORT' })
  })
})

describe('probeBridge', () => {
  it('reports models, latency and both health checks', async () => {
    const fetchImpl = vi.fn(async (url: string) => url.endsWith('/models')
      ? new Response(JSON.stringify({ data: [{ id: 'gemini-3.8-flash-low' }, { id: 'x' }] }))
      : url.endsWith('/health') ? new Response('{"status":"ok"}') : new Response('', { status: 401 }))
    const result = await probeBridge(settings, { fetchImpl: fetchImpl as unknown as typeof fetch, coreUrl: 'http://core' })
    expect(result).toMatchObject({ ok: true, models: ['gemini-3.8-flash-low', 'x'], gatewayUp: true, coreUp: true })
  })

  it('names a bad key and a down core without throwing', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith('http://core')) throw new TypeError('ECONNREFUSED')
      return url.endsWith('/models') ? new Response('', { status: 401 }) : new Response('ok')
    })
    const result = await probeBridge(settings, { fetchImpl: fetchImpl as unknown as typeof fetch, coreUrl: 'http://core' })
    expect(result).toMatchObject({ ok: false, gatewayUp: true, coreUp: false })
    expect(result.error).toContain('API key')
  })
})

describe('AntigravityAdapter bridge routing', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends requests to the gateway with the effort wire id and never acquires a direct account', async () => {
    const fetchImpl = vi.fn(async () => sse({ choices: [{ delta: { content: 'bridged' }, finish_reason: 'stop' }] }))
    vi.stubGlobal('fetch', fetchImpl)
    const acquire = vi.fn()
    const session = {
      manager: { read: async () => settings },
      acquire,
      thoughtSignatures: new Map(),
    }
    const adapter = createAntigravityAdapter(session as never, { nativeTools: true, nativeSearch: true })
    const chunks = await collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      reasoningEffort: 'high',
      messages: [msg('user', [{ type: 'text', text: 'hi' }])],
      tools: [{ name: 'read_file', description: 'r', parameters: { type: 'object' } }],
    } as unknown as GenerateOptions))
    expect(acquire).not.toHaveBeenCalled()
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string) as BridgeRequest
    expect(body.model).toBe('gemini-3.8-flash-high')
    expect(body.tools?.map(tool => tool.function.name)).toEqual(['read_file'])
    expect(chunks).toContainEqual({ type: 'block-end', index: 0, block: { type: 'text', text: 'bridged' } })
  })
})
