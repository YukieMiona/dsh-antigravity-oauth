import { describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  DEFAULT_WEB2API_SETTINGS,
  DEFAULT_WEB2API_MODELS,
  type Web2ApiSettings,
} from '../src/web2api/types.ts'
import { AntigravityWeb2ApiStore, sanitizeWeb2ApiSettings } from '../src/web2api/store.ts'
import { Web2ApiClient } from '../src/web2api/client.ts'
import {
  Web2ApiAdapter,
  convertMessagesToOpenAi,
  WEB2API_ROUTE,
} from '../src/web2api/adapter.ts'
import type { GenerateOptions, MessageId, StreamChunk } from '@deepseek-ai/dsh-llm'

describe('Web2API Types and Store', () => {
  it('sanitizes empty or corrupted raw settings to sensible defaults', () => {
    expect(sanitizeWeb2ApiSettings(null)).toEqual(DEFAULT_WEB2API_SETTINGS)
    expect(sanitizeWeb2ApiSettings({})).toEqual(DEFAULT_WEB2API_SETTINGS)
    expect(sanitizeWeb2ApiSettings({
      enabled: true,
      baseUrl: 'http://localhost:9000/',
      apiKey: '  secret_key  ',
      models: ['custom-model'],
      enableImageTool: false,
    })).toEqual({
      enabled: true,
      baseUrl: 'http://localhost:9000',
      apiKey: 'secret_key',
      models: ['custom-model'],
      enableImageTool: false,
      timeoutMs: 120_000,
    })
  })

  it('reads and writes settings atomically to disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-web2api-store-'))
    try {
      const store = new AntigravityWeb2ApiStore(join(dir, 'settings.json'))
      const initial = await store.read()
      expect(initial.enabled).toBe(false)

      const saved = await store.save({ enabled: true, baseUrl: 'http://127.0.0.1:8080/v1' })
      expect(saved.enabled).toBe(true)

      const reloaded = await store.read()
      expect(reloaded.enabled).toBe(true)
      expect(reloaded.baseUrl).toBe('http://127.0.0.1:8080/v1')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('tests connection endpoint and handles network failure gracefully', async () => {
    const store = new AntigravityWeb2ApiStore('/dev/null')
    const result = await store.testConnection({ baseUrl: 'http://127.0.0.1:54321/v1' })
    expect(result.ok).toBe(false)
    expect(typeof result.latencyMs).toBe('number')
    expect(result.error).toBeDefined()
  })
})

describe('Web2API Message Conversion', () => {
  it('converts system prompt and user/assistant messages to OpenAI schema', () => {
    const messages = [
      {
        id: 'msg_1' as MessageId,
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'Hello, what is your name?' }],
      },
      {
        id: 'msg_2' as MessageId,
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'I am Gemini.' }],
      },
      {
        id: 'msg_3' as MessageId,
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'Tell me a joke.' }],
      },
    ]

    const result = convertMessagesToOpenAi(messages, 'You are a helpful assistant.')
    expect(result).toEqual([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello, what is your name?' },
      { role: 'assistant', content: 'I am Gemini.' },
      { role: 'user', content: 'Tell me a joke.' },
    ])
  })
})

describe('Web2API Streaming Client and Adapter', () => {
  async function withMockServer(
    handler: (req: IncomingMessage, res: ServerResponse) => void,
    testFn: (baseUrl: string) => Promise<void>,
  ): Promise<void> {
    const server = createServer(handler)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Bad server address')
    const baseUrl = `http://127.0.0.1:${address.port}/v1`
    try {
      await testFn(baseUrl)
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  }

  it('rejects streaming when Web2API is disabled with NO_ADAPTER error', async () => {
    const adapter = new Web2ApiAdapter(async () => ({ ...DEFAULT_WEB2API_SETTINGS, enabled: false }))
    const options: GenerateOptions = {
      provider: WEB2API_ROUTE,
      model: 'gemini-2.5-flash',
      messages: [{ id: '1' as MessageId, role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'hi' }] }],
    }

    const stream = adapter.stream(options)
    await expect(async () => {
      for await (const _chunk of stream) {}
    }).rejects.toThrow(/disabled/)
  })

  it('streams thought, content, and usage chunks seamlessly from mock SSE stream', async () => {
    await withMockServer((req, res) => {
      if (req.url?.includes('/chat/completions')) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })
        res.write('data: {"choices":[{"delta":{"reasoning_content":"Thinking about answer..."}}]}\n\n')
        res.write('data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n')
        res.write('data: {"choices":[{"delta":{"content":"world!"}}]}\n\n')
        res.write('data: {"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n')
        res.write('data: [DONE]\n\n')
        res.end()
      } else {
        res.writeHead(404)
        res.end()
      }
    }, async (baseUrl) => {
      const adapter = new Web2ApiAdapter(async () => ({
        ...DEFAULT_WEB2API_SETTINGS,
        enabled: true,
        baseUrl,
      }))

      const chunks: StreamChunk[] = []
      for await (const chunk of adapter.stream({
        provider: WEB2API_ROUTE,
        model: 'gemini-2.5-flash',
        messages: [{ id: '1' as MessageId, role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'hi' }] }],
      })) {
        chunks.push(chunk)
      }

      // Check reasoning
      const reasoningStart = chunks.find(c => c.type === 'block-start' && c.blockType === 'reasoning')
      expect(reasoningStart).toBeDefined()
      const reasoningDelta = chunks.find(c => c.type === 'reasoning-delta')
      expect(reasoningDelta).toMatchObject({ text: 'Thinking about answer...' })

      // Check text
      const textStart = chunks.find(c => c.type === 'block-start' && c.blockType === 'text')
      expect(textStart).toBeDefined()
      const textDeltas = chunks.filter(c => c.type === 'text-delta')
      expect(textDeltas.map(t => (t as any).text).join('')).toBe('Hello world!')

      // Check usage
      const usage = chunks.find(c => c.type === 'usage')
      expect(usage).toMatchObject({
        type: 'usage',
        usage: { inputTokens: 10, outputTokens: 5 },
      })
    })
  })

  it('parses inline <thought> tags when the model emits thoughts inside content', async () => {
    await withMockServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      res.write('data: {"choices":[{"delta":{"content":"<thought>Internal reflection</thought>Final reply"}}]}\n\n')
      res.write('data: [DONE]\n\n')
      res.end()
    }, async (baseUrl) => {
      const client = new Web2ApiClient(async () => ({
        ...DEFAULT_WEB2API_SETTINGS,
        enabled: true,
        baseUrl,
      }))

      const events = []
      for await (const event of client.streamChat({ model: 'gemini-2.5-flash', messages: [] })) {
        events.push(event)
      }

      expect(events).toContainEqual({ type: 'thought', text: 'Internal reflection' })
      expect(events).toContainEqual({ type: 'text', text: 'Final reply' })
    })
  })

  it('lists and resolves models with proper context window definitions', async () => {
    const adapter = new Web2ApiAdapter(async () => ({
      ...DEFAULT_WEB2API_SETTINGS,
      enabled: true,
      models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    }))

    const list = await adapter.listModels(WEB2API_ROUTE)
    expect(list.map(m => m.id)).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro'])

    const resolved = await adapter.resolveModel(WEB2API_ROUTE, 'gemini-2.5-flash')
    expect(resolved.id).toBe('gemini-2.5-flash')
    expect(resolved.context?.contextWindow).toBe(1_048_576)
  })
})
