import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { describe, expect, it, vi } from 'vitest'
import { createAntigravityAdapter } from '../src/adapter.ts'
import { CcaHttpError } from '../src/cca-client.ts'
import { AntigravitySession } from '../src/session.ts'
import type { CcaEvent, ChatGenerateInput, SearchGenerateInput } from '../src/types.ts'

const oauth = {
  type: 'oauth' as const,
  access: 't',
  refresh: 'r',
  expires: Date.now() + 60_000,
  projectId: 'proj',
}

const NEWS = '搜搜新闻看看最近 12 小时科技圈值得关注的新闻'

function options(text: string): GenerateOptions {
  return {
    provider: 'agy-google-antigravity',
    model: 'gemini-3.7-flash',
    messages: [{
      id: 'u1',
      role: 'user',
      source: { kind: 'user' },
      content: [{ type: 'text', text }],
    }],
    tools: [{ name: 'read_file', description: 'read', parameters: { type: 'object' } }],
  } as unknown as GenerateOptions
}

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

function asScripts(events: CcaEvent[] | CcaEvent[][] | undefined): CcaEvent[][] {
  if (events === undefined) return [[{ type: 'finish', reason: 'STOP' }]]
  if (events.length > 0 && !Array.isArray(events[0])) return [events as CcaEvent[]]
  return events as CcaEvent[][]
}

function fakeSession(script: {
  chat?: CcaEvent[] | CcaEvent[][]
  search?: CcaEvent[] | CcaEvent[][]
}) {
  const chatBodies: ChatGenerateInput[] = []
  const searchQueries: string[] = []
  const chatScripts = asScripts(script.chat)
  const searchScripts = asScripts(script.search ?? [{ type: 'text', text: 'grounded news' }, { type: 'finish', reason: 'STOP' }])
  let chatIndex = 0
  let searchIndex = 0
  const cca = {
    async *chat(_oauth: unknown, input: ChatGenerateInput): AsyncIterable<CcaEvent> {
      chatBodies.push(input)
      const events = chatScripts[Math.min(chatIndex, chatScripts.length - 1)] ?? [{ type: 'finish' as const, reason: 'STOP' }]
      chatIndex += 1
      for (const event of events) yield event
    },
    async *search(_oauth: unknown, input: SearchGenerateInput): AsyncIterable<CcaEvent> {
      searchQueries.push(input.query)
      const events = searchScripts[Math.min(searchIndex, searchScripts.length - 1)] ?? [{ type: 'text' as const, text: 'grounded news' }, { type: 'finish' as const, reason: 'STOP' }]
      searchIndex += 1
      for (const event of events) yield event
    },
  }
  const session = {
    thoughtSignatures: new Map<string, string>(),
    acquire: async () => ({
      oauth,
      accountId: 'acc_test',
      email: 'test@example.test',
      cca,
    }),
    cca,
  } as unknown as AntigravitySession
  return { session, chatBodies, searchQueries }
}

function visibleText(chunks: StreamChunk[]): string {
  return chunks
    .filter(chunk => chunk.type === 'text-delta')
    .map(chunk => chunk.text)
    .join('')
}

function functionResponses(input: ChatGenerateInput | undefined): Array<{ name: string, result: unknown }> {
  if (input === undefined) return []
  const found: Array<{ name: string, result: unknown }> = []
  for (const content of input.contents) {
    for (const part of content.parts) {
      if (!('functionResponse' in part)) continue
      found.push({
        name: part.functionResponse.name,
        result: part.functionResponse.response.result,
      })
    }
  }
  return found
}

describe('AntigravityAdapter search', () => {
  it('never offers generate_image, even for a kitten prompt', async () => {
    const fake = fakeSession({
      chat: [{ type: 'text', text: 'ok' }, { type: 'finish', reason: 'STOP' }],
    })
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })
    await collect(adapter.stream(options('给我生成一张小猫图')))
    const names = fake.chatBodies[0]?.functions.map(tool => tool.name) ?? []
    expect(names).toContain('search_web')
    expect(names).not.toContain('generate_image')
  })

  it('runs googleSearch when the model forgets to call search_web, then continues the chat', async () => {
    const fake = fakeSession({
      chat: [
        [{ type: 'text', text: 'I will look that up.' }, { type: 'finish', reason: 'STOP' }],
        [{ type: 'text', text: '根据搜索，今天这些值得看。' }, { type: 'finish', reason: 'STOP' }],
      ],
    })
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })
    const chunks = await collect(adapter.stream(options(NEWS)))
    expect(fake.searchQueries).toEqual([NEWS])
    expect(fake.chatBodies).toHaveLength(2)
    const text = visibleText(chunks)
    expect(text).toContain('I will look that up.')
    expect(text).toContain('根据搜索，今天这些值得看。')
    expect(text).not.toContain('grounded news')
    expect(JSON.stringify(fake.chatBodies[1]?.contents)).toContain('grounded news')
    expect(fake.chatBodies[1]?.system).toContain('same language the user used')
  })

  it('drops a hallucinated generate_image call and still searches news', async () => {
    const fake = fakeSession({
      chat: [
        [{
          type: 'functionCall',
          name: 'generate_image',
          args: { prompt: 'kitten' },
        }, { type: 'finish', reason: 'STOP' }],
        [{ type: 'text', text: '新闻如下。' }, { type: 'finish', reason: 'STOP' }],
      ],
    })
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })
    const chunks = await collect(adapter.stream(options(NEWS)))
    expect(fake.searchQueries).toEqual([NEWS])
    const text = visibleText(chunks)
    expect(text).toContain('新闻如下。')
    expect(text).not.toContain('grounded news')
    expect(text).not.toContain('Image generation failed')
    const finish = chunks.find(chunk => chunk.type === 'finish')
    expect(finish).toEqual({ type: 'finish', reason: { kind: 'stop' } })
  })

  it('feeds search_web results back as a functionResponse and continues', async () => {
    const fake = fakeSession({
      chat: [
        [{
          type: 'functionCall',
          id: 'call_search',
          name: 'search_web',
          args: { query: 'vendor official docs' },
          thoughtSignature: 'sig-search',
        }, { type: 'finish', reason: 'STOP' }],
        [{ type: 'text', text: '按官方文档这样填。' }, { type: 'finish', reason: 'STOP' }],
      ],
    })
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })
    const chunks = await collect(adapter.stream(options('你查一下官方资料')))
    expect(fake.searchQueries).toEqual(['vendor official docs'])
    expect(fake.session.thoughtSignatures.get('call_search')).toBe('sig-search')
    expect(visibleText(chunks)).toBe('按官方文档这样填。')
    expect(visibleText(chunks)).not.toContain('grounded news')
    expect(functionResponses(fake.chatBodies[1])).toEqual([
      { name: 'search_web', result: 'grounded news' },
    ])
    const followUpCall = fake.chatBodies[1]?.contents
      .flatMap(content => content.parts)
      .find(part => 'functionCall' in part) as {
        functionCall: { name: string, id?: string }
        thoughtSignature?: string
      }
    expect(followUpCall?.functionCall.name).toBe('search_web')
    expect(followUpCall?.thoughtSignature).toBe('sig-search')
    expect(chunks.find(chunk => chunk.type === 'finish')).toEqual({
      type: 'finish',
      reason: { kind: 'stop' },
    })
    expect(chunks.some(chunk => chunk.type === 'tool-call-delta')).toBe(false)
  })

  it('searches a research prompt even when the model only thinks then stops', async () => {
    const fake = fakeSession({
      chat: [
        [{ type: 'thought', text: 'Identifying the Target Platform' }, { type: 'finish', reason: 'STOP' }],
        [{ type: 'text', text: '按官方文档这样配。' }, { type: 'finish', reason: 'STOP' }],
      ],
    })
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })
    const chunks = await collect(adapter.stream(options('帮我调研一下这个 API 官方怎么配')))
    expect(fake.searchQueries).toHaveLength(1)
    expect(fake.searchQueries[0]).toContain('调研')
    expect(visibleText(chunks)).toContain('按官方文档这样配。')
    expect(visibleText(chunks)).not.toContain('grounded news')
    expect(chunks.find(chunk => chunk.type === 'finish')).toEqual({
      type: 'finish',
      reason: { kind: 'stop' },
    })
  })

  it('continues a thought-only stop that is not a search prompt', async () => {
    const fake = fakeSession({
      chat: [
        [{ type: 'thought', text: 'Hmm.' }, { type: 'finish', reason: 'STOP' }],
        [{ type: 'text', text: '好的，我在。' }, { type: 'finish', reason: 'STOP' }],
      ],
    })
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })
    const chunks = await collect(adapter.stream(options('你好')))
    expect(fake.searchQueries).toEqual([])
    expect(fake.chatBodies).toHaveLength(2)
    expect(JSON.stringify(fake.chatBodies[1]?.contents)).toContain('only internal reasoning')
    expect(visibleText(chunks)).toBe('好的，我在。')
  })

  it('does not stop after a search_web loop with no user-visible answer', async () => {
    const fake = fakeSession({
      chat: [
        [{
          type: 'thought',
          text: 'Need current docs.',
        }, {
          type: 'functionCall',
          name: 'search_web',
          args: { query: 'vendor docs query one' },
        }, { type: 'finish', reason: 'STOP' }],
        [{
          type: 'functionCall',
          name: 'search_web',
          args: { query: 'vendor docs query two' },
        }, { type: 'finish', reason: 'STOP' }],
        [{
          type: 'functionCall',
          name: 'search_web',
          args: { query: 'vendor docs query three' },
        }, { type: 'finish', reason: 'STOP' }],
        [{ type: 'text', text: '按官方文档这样配。' }, { type: 'finish', reason: 'STOP' }],
      ],
    })
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })
    const chunks = await collect(adapter.stream(options('帮我调研一下这个 API 官方怎么配')))
    expect(fake.searchQueries).toEqual([
      'vendor docs query one',
      'vendor docs query two',
      'vendor docs query three',
    ])
    expect(fake.chatBodies.length).toBeGreaterThanOrEqual(4)
    const answerTurn = fake.chatBodies.at(-1)
    expect(answerTurn?.functions.some(tool => tool.name === 'search_web')).toBe(false)
    expect(visibleText(chunks)).toContain('按官方文档这样配。')
    expect(chunks.find(chunk => chunk.type === 'finish')).toEqual({
      type: 'finish',
      reason: { kind: 'stop' },
    })
  })

  it('lets the model call ordinary tools after search_web returns', async () => {
    const fake = fakeSession({
      chat: [
        [{
          type: 'functionCall',
          name: 'search_web',
          args: { query: 'vendor context window' },
        }, { type: 'finish', reason: 'STOP' }],
        [{
          type: 'functionCall',
          id: 'call_read',
          name: 'read_file',
          args: { path: '/tmp/settings.yaml' },
        }, { type: 'finish', reason: 'STOP' }],
      ],
    })
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })
    const chunks = await collect(adapter.stream(options('对照文档再决定怎么写')))
    expect(fake.searchQueries).toEqual(['vendor context window'])
    expect(visibleText(chunks)).toBe('')
    const tool = chunks.find(chunk => chunk.type === 'tool-call-delta')
    expect(tool).toMatchObject({ name: 'read_file', id: 'call_read' })
    expect(chunks.find(chunk => chunk.type === 'finish')).toEqual({
      type: 'finish',
      reason: { kind: 'tool-calls' },
    })
  })

  it('replays thought_signature on the next CCA functionCall part', async () => {
    const fake = fakeSession({
      chat: [{
        type: 'functionCall',
        id: 'call_skill',
        name: 'skill',
        args: { name: 'unslop' },
        thoughtSignature: 'sig-abc',
      }, { type: 'finish', reason: 'STOP' }],
    })
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })
    await collect(adapter.stream(options('hi')))
    expect(fake.session.thoughtSignatures.get('call_skill')).toBe('sig-abc')

    const followUp: GenerateOptions = {
      ...options('continue'),
      messages: [
        {
          id: 'u1',
          role: 'user',
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'hi' }],
        },
        {
          id: 'a1',
          role: 'assistant',
          source: { kind: 'model', provider: 'agy-google-antigravity', model: 'gemini-3.7-flash' },
          content: [{
            type: 'tool-call',
            id: 'call_skill',
            name: 'skill',
            arguments: '{"name":"unslop"}',
          }],
        },
        {
          id: 't1',
          role: 'tool',
          source: { kind: 'tool', callId: 'call_skill' },
          toolCallId: 'call_skill',
          content: [{ type: 'text', text: 'loaded' }],
        },
      ],
    } as unknown as GenerateOptions
    ;(fake.session as unknown as { cca: { chat: unknown } }).cca.chat = async function* (_oauth: unknown, input: ChatGenerateInput) {
      fake.chatBodies.push(input)
      yield { type: 'text' as const, text: 'ok' }
      yield { type: 'finish' as const, reason: 'STOP' }
    }
    await collect(adapter.stream(followUp))
    const contents = fake.chatBodies.at(-1)?.contents ?? []
    const model = contents.find(entry => entry.role === 'model')
    const call = model?.parts.find(part => 'functionCall' in part) as {
      functionCall: { name: string }
      thoughtSignature?: string
    }
    expect(call?.functionCall.name).toBe('skill')
    expect(call?.thoughtSignature).toBe('sig-abc')
    const tool = contents.find(entry => entry.role === 'user' && entry.parts.some(part => 'functionResponse' in part))
    const response = tool?.parts.find(part => 'functionResponse' in part) as {
      functionResponse: { name: string }
    }
    expect(response?.functionResponse.name).toBe('skill')
  })

  it('names the exhausted account and marks it rate limited on a quota error', async () => {
    const limited: string[] = []
    const session = {
      thoughtSignatures: new Map<string, string>(),
      acquire: async () => ({
        oauth,
        accountId: 'acc_one',
        email: 'a@example.test',
        cca: {
          async *chat(): AsyncIterable<CcaEvent> {
            throw new CcaHttpError(429, 'RESOURCE_EXHAUSTED')
          },
        },
      }),
      noteRateLimited: (id: string) => { limited.push(id) },
    } as unknown as AntigravitySession
    const adapter = createAntigravityAdapter(session, {
      nativeTools: true,
      nativeSearch: true,
    })
    await expect(collect(adapter.stream(options('hi')))).rejects.toThrow(/a@example\.test.*Settings → Antigravity/)
    expect(limited).toEqual(['acc_one'])
  })

  it('automatically fails over to an available account when 429 occurs before any chunks are emitted', async () => {
    const limited: string[] = []
    const switched: string[] = []
    let callCount = 0

    const session = {
      thoughtSignatures: new Map<string, string>(),
      acquire: async () => ({
        oauth,
        accountId: 'acc_exhausted',
        email: 'exhausted@example.test',
        cca: {
          async *chat(): AsyncIterable<CcaEvent> {
            callCount++
            throw new CcaHttpError(429, 'RESOURCE_EXHAUSTED')
          },
        },
      }),
      noteRateLimited: (id: string) => { limited.push(id) },
      findFailoverAccount: async (excludeId: string) => {
        return excludeId === 'acc_exhausted'
          ? { id: 'acc_healthy', email: 'healthy@example.test', projectId: 'healthy-proj' }
          : undefined
      },
      acquireForAccount: async (id: string) => {
        if (id !== 'acc_healthy') return undefined
        return {
          oauth,
          accountId: 'acc_healthy',
          email: 'healthy@example.test',
          cca: {
            async *chat(): AsyncIterable<CcaEvent> {
              callCount++
              yield { type: 'text', text: 'recovered hello from failover account' }
              yield { type: 'finish', reason: 'STOP' }
            },
          },
        }
      },
      switchAccount: async (id: string) => {
        switched.push(id)
        return {} as any
      },
    } as unknown as AntigravitySession

    const adapter = createAntigravityAdapter(session, {
      nativeTools: true,
      nativeSearch: true,
    })

    const chunks = await collect(adapter.stream(options('hi')))
    expect(callCount).toBe(2)
    expect(limited).toEqual(['acc_exhausted'])
    expect(switched).toEqual(['acc_healthy'])
    const textChunk = chunks.find(c => c.type === 'text-delta') as { type: 'text-delta', text: string } | undefined
    expect(textChunk?.text).toBe('recovered hello from failover account')
  })
})

describe('AntigravityAdapter usage', () => {
  it('counts cumulative snapshots once within a single chat request', async () => {
    const fake = fakeSession({
      chat: [
        { type: 'usage', usage: { inputTokens: 80_000, outputTokens: 10, reasoningTokens: 1, cacheReadTokens: 40_000 } },
        { type: 'text', text: 'answer' },
        { type: 'usage', usage: { inputTokens: 80_000, outputTokens: 20, reasoningTokens: 2, cacheReadTokens: 40_000 } },
        { type: 'usage', usage: { inputTokens: 80_000, outputTokens: 20, reasoningTokens: 2, cacheReadTokens: 40_000 } },
        { type: 'finish', reason: 'STOP' },
      ],
    })
    const adapter = createAntigravityAdapter(fake.session, { nativeTools: true, nativeSearch: true })
    const chunks = await collect(adapter.stream(options('hi')))
    expect(chunks.filter(chunk => chunk.type === 'usage')).toEqual([{
      type: 'usage',
      usage: { inputTokens: 80_000, outputTokens: 20, reasoningTokens: 2, cacheReadTokens: 40_000 },
    }])
    expect(fake.chatBodies).toHaveLength(1)
    expect(visibleText(chunks)).toBe('answer')
  })

  it('preserves earlier counters when a later chat snapshot omits them', async () => {
    const fake = fakeSession({
      chat: [
        { type: 'usage', usage: { inputTokens: 80_000, outputTokens: 20, reasoningTokens: 8, cacheReadTokens: 40_000 } },
        { type: 'usage', usage: { inputTokens: 0, outputTokens: 30 } },
        { type: 'text', text: 'answer' },
        { type: 'finish', reason: 'STOP' },
      ],
    })
    const adapter = createAntigravityAdapter(fake.session, { nativeTools: true, nativeSearch: true })
    const chunks = await collect(adapter.stream(options('hi')))
    expect(chunks.find(chunk => chunk.type === 'usage')).toEqual({
      type: 'usage',
      usage: { inputTokens: 80_000, outputTokens: 30, reasoningTokens: 8, cacheReadTokens: 40_000 },
    })
  })

  it('adds independent chat, search, and answer requests after deduplicating their snapshots', async () => {
    const fake = fakeSession({
      chat: [
        [
          { type: 'usage', usage: { inputTokens: 1000, outputTokens: 5, reasoningTokens: 1 } },
          { type: 'functionCall', name: 'search_web', args: { query: 'vendor docs' } },
          { type: 'usage', usage: { inputTokens: 1000, outputTokens: 10, reasoningTokens: 2 } },
          { type: 'finish', reason: 'STOP' },
        ],
        [
          { type: 'usage', usage: { inputTokens: 1200, outputTokens: 10, reasoningTokens: 1 } },
          { type: 'text', text: 'answer' },
          { type: 'usage', usage: { inputTokens: 1200, outputTokens: 20, reasoningTokens: 3 } },
          { type: 'finish', reason: 'STOP' },
        ],
      ],
      search: [
        { type: 'usage', usage: { inputTokens: 200, outputTokens: 15, reasoningTokens: 2 } },
        { type: 'text', text: 'grounded news' },
        { type: 'usage', usage: { inputTokens: 200, outputTokens: 30, reasoningTokens: 4 } },
        { type: 'finish', reason: 'STOP' },
      ],
    })
    const adapter = createAntigravityAdapter(fake.session, { nativeTools: true, nativeSearch: true })
    const chunks = await collect(adapter.stream(options('hi')))
    expect(chunks.find(chunk => chunk.type === 'usage')).toEqual({
      type: 'usage',
      usage: { inputTokens: 2400, outputTokens: 60, reasoningTokens: 9 },
    })
    expect(fake.chatBodies).toHaveLength(2)
    expect(fake.searchQueries).toEqual(['vendor docs'])
    expect(functionResponses(fake.chatBodies[1])).toEqual([{ name: 'search_web', result: 'grounded news' }])
    expect(visibleText(chunks)).toBe('answer')
    expect(chunks.at(-1)).toEqual({ type: 'finish', reason: { kind: 'stop' } })
  })

  it('adds reasoning usage across thought-only continuation requests', async () => {
    const fake = fakeSession({
      chat: [
        [
          { type: 'thought', text: 'Hmm.' },
          { type: 'usage', usage: { inputTokens: 1000, outputTokens: 0, reasoningTokens: 10 } },
          { type: 'finish', reason: 'STOP' },
        ],
        [
          { type: 'text', text: 'answer' },
          { type: 'usage', usage: { inputTokens: 1100, outputTokens: 20, reasoningTokens: 3 } },
          { type: 'finish', reason: 'STOP' },
        ],
      ],
    })
    const adapter = createAntigravityAdapter(fake.session, { nativeTools: true, nativeSearch: true })
    const chunks = await collect(adapter.stream(options('hi')))
    expect(chunks.find(chunk => chunk.type === 'usage')).toEqual({
      type: 'usage',
      usage: { inputTokens: 2100, outputTokens: 20, reasoningTokens: 13 },
    })
    expect(fake.chatBodies).toHaveLength(2)
    expect(fake.searchQueries).toEqual([])
    expect(visibleText(chunks)).toBe('answer')
  })

  it('preserves earlier search counters when its final snapshot omits them', async () => {
    const fake = fakeSession({
      chat: [
        [
          { type: 'functionCall', name: 'search_web', args: { query: 'vendor docs' } },
          { type: 'usage', usage: { inputTokens: 1000, outputTokens: 10, reasoningTokens: 2 } },
          { type: 'finish', reason: 'STOP' },
        ],
        [
          { type: 'text', text: 'answer' },
          { type: 'usage', usage: { inputTokens: 1200, outputTokens: 20, reasoningTokens: 3 } },
          { type: 'finish', reason: 'STOP' },
        ],
      ],
      search: [
        { type: 'usage', usage: { inputTokens: 200, outputTokens: 30, reasoningTokens: 4 } },
        { type: 'text', text: 'grounded news' },
        { type: 'usage', usage: { inputTokens: 0, outputTokens: 40 } },
        { type: 'finish', reason: 'STOP' },
      ],
    })
    const adapter = createAntigravityAdapter(fake.session, { nativeTools: true, nativeSearch: true })
    const chunks = await collect(adapter.stream(options('hi')))
    expect(chunks.find(chunk => chunk.type === 'usage')).toEqual({
      type: 'usage',
      usage: { inputTokens: 2400, outputTokens: 70, reasoningTokens: 9 },
    })
  })

  it('omits usage when no request reports it', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'answer' }, { type: 'finish', reason: 'STOP' }] })
    const adapter = createAntigravityAdapter(fake.session, { nativeTools: true, nativeSearch: true })
    const chunks = await collect(adapter.stream(options('hi')))
    expect(chunks.some(chunk => chunk.type === 'usage')).toBe(false)
    expect(visibleText(chunks)).toBe('answer')
  })
})

describe('AntigravityAdapter model catalog', () => {
  it('omits toolUpdate so 0.2.0-rc.2 sends the complete tool list', async () => {
    const fake = fakeSession({})
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })
    const resolved = await adapter.resolveModel('agy-google-antigravity', 'gemini-3.7-flash')
    expect(resolved.toolUpdate).toBeUndefined()
    expect(resolved.id).toBe('gemini-3.7-flash')

    const argonResolved = await adapter.resolveModel('agy-google-antigravity', 'gemini-4-argon')
    expect(argonResolved.id).toBe('gemini-4-argon')
    expect(argonResolved.name).toBe('Gemini 4 Argon')
    expect(argonResolved.context?.contextWindow).toBe(1_048_576)
    expect(argonResolved.defaultMaxTokens).toBe(65_536)
    expect(argonResolved.reasoning?.efforts).toHaveLength(3)
    expect(argonResolved.reasoning?.defaultEffort).toBe('medium')
  })

  it('applies user-configured modelContextWindow (clamped and floored) and defaultReasoningEffort', async () => {
    const fake = fakeSession({})
    let configuredWindow = 524_288.9
    ;(fake.session as any).getAdvancedSettings = async () => ({
      defaultReasoningEffort: 'high',
      modelContextWindow: configuredWindow,
      switchingStrategy: 'failover_429',
      proactiveThreshold: 20,
    })
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })

    const resolved512k = await adapter.resolveModel('agy-google-antigravity', 'gemini-3.8-flash')
    expect(resolved512k.context?.contextWindow).toBe(524_288)
    expect(resolved512k.reasoning?.defaultEffort).toBe('high')

    configuredWindow = 2_097_152
    const clamped = await adapter.resolveModel('agy-google-antigravity', 'gemini-4-argon')
    expect(clamped.context?.contextWindow).toBe(1_048_576)
  })
})

describe('AntigravityAdapter multimodal image input', () => {
  const imageOf = (bytes: number, offloaded = false) => ({
    type: 'image',
    attachment: { attachmentId: `att-${bytes}`, mediaType: 'image/png', name: 'big.png', bytes, width: 1, height: 1 },
    ...offloaded ? { offloaded: true } : {},
  })
  const streamImages = (adapter: ReturnType<typeof createAntigravityAdapter>, content: unknown[]) => adapter.stream({
    provider: 'agy-google-antigravity',
    model: 'gemini-3.8-flash',
    messages: [{ id: 'u1', role: 'user', source: { kind: 'user' }, content }],
    tools: [],
  } as any)

  it('asks the harness to offload images over the request budget', async () => {
    const fake = fakeSession({})
    const adapter = createAntigravityAdapter(fake.session, { nativeTools: true, nativeSearch: true })

    await expect(collect(streamImages(adapter, [imageOf(8_000_000), imageOf(8_000_001)])))
      .rejects.toMatchObject({ code: 'IMAGE_OFFLOAD_REQUIRED', failure: { offloadImages: 1 } })
    expect(fake.chatBodies).toHaveLength(0)
  })

  it('counts tool result images toward the request budget', async () => {
    const fake = fakeSession({})
    const adapter = createAntigravityAdapter(fake.session, { nativeTools: true, nativeSearch: true })

    await expect(collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages: [
        { id: 'u1', role: 'user', source: { kind: 'user' }, content: [imageOf(8_000_000)] },
        { id: 'a1', role: 'assistant', content: [{ type: 'tool-call', id: 'call_1', name: 'read_image', arguments: '{}' }] },
        { id: 't1', role: 'tool', toolCallId: 'call_1', content: [imageOf(8_000_001)] },
      ],
      tools: [],
    } as any))).rejects.toMatchObject({ code: 'IMAGE_OFFLOAD_REQUIRED', failure: { offloadImages: 1 } })
    expect(fake.chatBodies).toHaveLength(0)
  })

  it('sends a request when offloaded images bring it under the budget', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'ok' }, { type: 'finish', reason: 'STOP' }] })
    const adapter = createAntigravityAdapter(fake.session, { nativeTools: true, nativeSearch: true })

    await collect(streamImages(adapter, [imageOf(8_000_000, true), imageOf(8_000_001)]))
    expect(fake.chatBodies).toHaveLength(1)
  })

  it('converts user image block to Gemini inlineData part with base64 payload', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'I see the image' }, { type: 'finish', reason: 'STOP' }] })
    const imageBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const mockAttachments = {
      readImage: async (ref: any) => ({
        ref: { ...ref, mediaType: 'image/png' },
        data: imageBytes,
      }),
    } as any

    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
      resolveAttachments: () => mockAttachments,
    })

    const messages = [{
      id: 'u1',
      role: 'user',
      source: { kind: 'user' },
      content: [
        { type: 'text', text: 'Please analyze this photo' },
        {
          type: 'image',
          attachment: {
            attachmentId: 'att-img-1',
            bytes: 8,
            mediaType: 'image/png',
            name: 'sample.png',
          },
        },
      ],
    }] as any

    await collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages,
      tools: [],
    } as any))

    expect(fake.chatBodies).toHaveLength(1)
    const userParts = fake.chatBodies[0].contents[0].parts
    expect(userParts).toHaveLength(2)
    expect(userParts[0]).toEqual({ text: 'Please analyze this photo' })
    expect(userParts[1]).toEqual({
      inlineData: {
        mimeType: 'image/png',
        data: Buffer.from(imageBytes).toString('base64'),
      },
    })
  })

  it('preserves interleaved order of text and image blocks', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'ok' }, { type: 'finish', reason: 'STOP' }] })
    const imgData = Uint8Array.from([0xff, 0xd8, 0xff])
    const mockAttachments = {
      readImage: async (ref: any) => ({
        ref: { ...ref, mediaType: 'image/jpeg' },
        data: imgData,
      }),
    } as any

    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
      resolveAttachments: () => mockAttachments,
    })

    const messages = [{
      id: 'u1',
      role: 'user',
      source: { kind: 'user' },
      content: [
        { type: 'text', text: 'First diagram:' },
        { type: 'image', attachment: { attachmentId: 'img1', bytes: 3, mediaType: 'image/jpeg' } },
        { type: 'text', text: 'Second diagram:' },
        { type: 'image', attachment: { attachmentId: 'img2', bytes: 3, mediaType: 'image/jpeg' } },
      ],
    }] as any

    await collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages,
      tools: [],
    } as any))

    const parts = fake.chatBodies[0].contents[0].parts
    expect(parts).toHaveLength(4)
    expect(parts[0]).toEqual({ text: 'First diagram:' })
    expect(parts[1]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: Buffer.from(imgData).toString('base64') } })
    expect(parts[2]).toEqual({ text: 'Second diagram:' })
    expect(parts[3]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: Buffer.from(imgData).toString('base64') } })
  })

  it('gracefully degrades to text placeholder if storage read fails or is missing', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'ok' }, { type: 'finish', reason: 'STOP' }] })
    const brokenAttachments = {
      readImage: async () => { throw new Error('disk read failed') },
    } as any

    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
      resolveAttachments: () => brokenAttachments,
    })

    const messages = [{
      id: 'u1',
      role: 'user',
      source: { kind: 'user' },
      content: [
        { type: 'image', attachment: { attachmentId: 'bad-img', bytes: 3, name: 'missing.png' } },
      ],
    }] as any

    await collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages,
      tools: [],
    } as any))

    const parts = fake.chatBodies[0].contents[0].parts
    expect(parts).toHaveLength(1)
    expect(parts[0]).toEqual({ text: '[Image: missing.png]' })
  })

  it('converts offloaded image to placeholder text saving prompt budget', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'ok' }, { type: 'finish', reason: 'STOP' }] })
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })

    const messages = [{
      id: 'u1',
      role: 'user',
      source: { kind: 'user' },
      content: [
        { type: 'image', attachment: { attachmentId: 'offloaded-1', name: 'chart.png' }, offloaded: true },
      ],
    }] as any

    await collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages,
      tools: [],
    } as any))

    const parts = fake.chatBodies[0].contents[0].parts
    expect(parts).toHaveLength(1)
    expect((parts[0] as { text: string }).text).toContain('image omitted to fit request image limits')
  })

  it('falls back to placeholder text when stored image data is 0 bytes', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'ok' }, { type: 'finish', reason: 'STOP' }] })
    const emptyAttachments = {
      readImage: async (ref: any) => ({
        ref: { ...ref, mediaType: 'image/png' },
        data: new Uint8Array(0),
      }),
    } as any

    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
      resolveAttachments: () => emptyAttachments,
    })

    const messages = [{
      id: 'u1',
      role: 'user',
      source: { kind: 'user' },
      content: [
        { type: 'image', attachment: { attachmentId: 'zero-byte', bytes: 3, name: 'empty.png' } },
      ],
    }] as any

    await collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages,
      tools: [],
    } as any))

    const parts = fake.chatBodies[0].contents[0].parts
    expect(parts).toHaveLength(1)
    expect(parts[0]).toEqual({ text: '[Image: empty.png]' })
  })

  it('rethrows abort signal error instead of swallowing it when user cancels', async () => {
    const fake = fakeSession({})
    const abortController = new AbortController()
    abortController.abort(new Error('User aborted'))

    const abortingAttachments = {
      readImage: async () => {
        throw new Error('Operation aborted')
      },
    } as any

    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
      resolveAttachments: () => abortingAttachments,
    })

    const messages = [{
      id: 'u1',
      role: 'user',
      source: { kind: 'user' },
      content: [
        { type: 'image', attachment: { attachmentId: 'img', bytes: 3, name: 'pic.png' } },
      ],
    }] as any

    await expect(collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages,
      tools: [],
      signal: abortController.signal,
    } as any))).rejects.toThrow()
  })

  it('converts tool result image blocks to Gemini inlineData within functionResponse', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'Inspected tool image' }, { type: 'finish', reason: 'STOP' }] })
    const imageBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02, 0x03, 0x04])
    const mockAttachments = {
      readImage: async (ref: any) => ({
        ref: { ...ref, mediaType: 'image/jpeg' },
        data: imageBytes,
      }),
    } as any

    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
      resolveAttachments: () => mockAttachments,
    })

    const messages = [
      {
        id: 'a1',
        role: 'assistant',
        source: { kind: 'model' },
        content: [
          {
            type: 'tool-call',
            id: 'call_read_img_1',
            name: 'read_image',
            arguments: '{"file_path":"test.jpg"}',
            thoughtSignature: 'sig-test',
          },
        ],
      },
      {
        id: 't1',
        role: 'tool',
        source: { kind: 'tool', callId: 'call_read_img_1' },
        toolCallId: 'call_read_img_1',
        content: [
          { type: 'text', text: '<path>test.jpg</path><type>image</type>' },
          {
            type: 'image',
            attachment: {
              attachmentId: 'att-tool-img-1',
              mediaType: 'image/jpeg',
              name: 'test.jpg',
            },
          },
        ],
      },
    ] as any

    await collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages,
      tools: [{ name: 'read_image', description: 'read img', parameters: { type: 'object' } }],
    } as any))

    expect(fake.chatBodies).toHaveLength(1)
    const contents = fake.chatBodies[0].contents
    expect(contents).toHaveLength(2)
    const toolContent = contents[1]
    expect(toolContent.role).toBe('user')
    expect(toolContent.parts).toHaveLength(1)
    expect(toolContent.parts[0]).toEqual({
      functionResponse: {
        name: 'read_image',
        id: 'call_read_img_1',
        response: { result: '<path>test.jpg</path><type>image</type>' },
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: Buffer.from(imageBytes).toString('base64'),
            },
          },
        ],
      },
    })
  })

  it('appends degraded and offloaded image placeholders to response.result', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'Handled degraded image' }, { type: 'finish', reason: 'STOP' }] })
    const mockAttachments = {
      readImage: async () => ({
        ref: { mediaType: 'image/jpeg' },
        data: new Uint8Array(0),
      }),
    } as any

    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
      resolveAttachments: () => mockAttachments,
    })

    const messages = [
      {
        id: 'a1',
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            id: 'call_degraded_1',
            name: 'read_image',
            arguments: '{}',
            thoughtSignature: 'sig-test',
          },
        ],
      },
      {
        id: 't1',
        role: 'tool',
        toolCallId: 'call_degraded_1',
        content: [
          { type: 'text', text: 'Read error log' },
          {
            type: 'image',
            attachment: { attachmentId: 'att-empty', name: 'empty.png' },
          },
          {
            type: 'image',
            attachment: { name: 'cloud.png' },
            offloaded: true,
          },
        ],
      },
    ] as any

    await collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages,
      tools: [{ name: 'read_image', description: 'read img', parameters: { type: 'object' } }],
    } as any))

    const contents = fake.chatBodies[0].contents
    const toolContent = contents[1]
    expect(toolContent.parts).toHaveLength(1)
    const fr = (toolContent.parts[0] as any).functionResponse
    expect(fr.parts).toBeUndefined()
    expect(fr.response.result).toMatch(/^Read error log\n\[Image: empty\.png\]\n\[image omitted to fit request image limits/)
  })

  it('handles pure image tool result without text description', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'Inspected pure image' }, { type: 'finish', reason: 'STOP' }] })
    const imageBytes = Uint8Array.from([0x12, 0x34])
    const mockAttachments = {
      readImage: async () => ({
        ref: { mediaType: 'image/png' },
        data: imageBytes,
      }),
    } as any

    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
      resolveAttachments: () => mockAttachments,
    })

    const messages = [
      {
        id: 'a1',
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            id: 'call_pure_img_1',
            name: 'capture_screen',
            arguments: '{}',
            thoughtSignature: 'sig-test',
          },
        ],
      },
      {
        id: 't1',
        role: 'tool',
        toolCallId: 'call_pure_img_1',
        content: [
          {
            type: 'image',
            attachment: { attachmentId: 'att-shot', name: 'screen.png' },
          },
        ],
      },
    ] as any

    await collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages,
      tools: [{ name: 'capture_screen', description: 'capture screen', parameters: { type: 'object' } }],
    } as any))

    const contents = fake.chatBodies[0].contents
    const toolContent = contents[1]
    expect(toolContent.parts).toHaveLength(1)
    const fr = (toolContent.parts[0] as any).functionResponse
    expect(fr.response.result).toBe('')
    expect(fr.parts).toHaveLength(1)
    expect(fr.parts[0].inlineData.mimeType).toBe('image/png')
  })

  it('batches consecutive parallel tool messages into a single user turn', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'Done parallel tools' }, { type: 'finish', reason: 'STOP' }] })
    const imgBytes = Uint8Array.from([0x99])
    const mockAttachments = {
      readImage: async () => ({
        ref: { mediaType: 'image/jpeg' },
        data: imgBytes,
      }),
    } as any

    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
      resolveAttachments: () => mockAttachments,
    })

    const messages = [
      {
        id: 'a1',
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            id: 'call_p1',
            name: 'tool_one',
            arguments: '{}',
            thoughtSignature: 'sig-1',
          },
          {
            type: 'tool-call',
            id: 'call_p2',
            name: 'tool_two',
            arguments: '{}',
            thoughtSignature: 'sig-2',
          },
        ],
      },
      {
        id: 't1',
        role: 'tool',
        toolCallId: 'call_p1',
        content: [{ type: 'text', text: 'Output from tool one' }],
      },
      {
        id: 't2',
        role: 'tool',
        toolCallId: 'call_p2',
        content: [
          { type: 'text', text: 'Output from tool two' },
          {
            type: 'image',
            attachment: { attachmentId: 'att-p2', name: 'tool_two.jpg' },
          },
        ],
      },
    ] as any

    await collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages,
      tools: [
        { name: 'tool_one', description: 't1', parameters: { type: 'object' } },
        { name: 'tool_two', description: 't2', parameters: { type: 'object' } },
      ],
    } as any))

    const contents = fake.chatBodies[0].contents
    expect(contents).toHaveLength(2)
    const toolContent = contents[1]
    expect(toolContent.role).toBe('user')
    expect(toolContent.parts).toHaveLength(2)
    expect((toolContent.parts[0] as any).functionResponse.name).toBe('tool_one')
    expect((toolContent.parts[1] as any).functionResponse.name).toBe('tool_two')
    expect((toolContent.parts[1] as any).functionResponse.parts).toHaveLength(1)
  })

  it('degrades orphaned tool result with images to user turn gracefully', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'Handled orphan' }, { type: 'finish', reason: 'STOP' }] })
    const imgBytes = Uint8Array.from([0x55])
    const mockAttachments = {
      readImage: async () => ({
        ref: { mediaType: 'image/png' },
        data: imgBytes,
      }),
    } as any

    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
      resolveAttachments: () => mockAttachments,
    })

    const messages = [
      {
        id: 't_orphan',
        role: 'tool',
        toolCallId: 'call_missing_from_history',
        content: [
          { type: 'text', text: 'Orphaned message' },
          {
            type: 'image',
            attachment: { attachmentId: 'att-orphan', name: 'orphan.png' },
          },
        ],
      },
    ] as any

    await collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages,
      tools: [],
    } as any))

    const contents = fake.chatBodies[0].contents
    expect(contents).toHaveLength(1)
    const userContent = contents[0]
    expect(userContent.role).toBe('user')
    expect(userContent.parts).toHaveLength(2)
    expect((userContent.parts[0] as any).text).toBe('Orphaned message')
    expect((userContent.parts[1] as any).inlineData).toBeDefined()
  })

  const toolTurnAdapter = () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'ok' }, { type: 'finish', reason: 'STOP' }] })
    const adapter = createAntigravityAdapter(fake.session, { nativeTools: true, nativeSearch: true })
    const run = (messages: unknown[]) => collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages,
      tools: [],
    } as any))
    return { fake, run }
  }
  const call = (id: string, signed = true) => ({
    type: 'tool-call', id, name: 'probe', arguments: '{}', ...signed ? { thoughtSignature: `sig-${id}` } : {},
  })
  const result = (id: string, content: unknown[]) => ({ id: `t-${id}`, role: 'tool', toolCallId: id, content })

  it('keeps an image placeholder where the image was in a tool result', async () => {
    const { fake, run } = toolTurnAdapter()
    await run([
      { id: 'a1', role: 'assistant', content: [call('c1')] },
      result('c1', [
        { type: 'text', text: 'before' },
        { type: 'image', attachment: { attachmentId: 'x', name: 'x.png' } },
        { type: 'text', text: 'after' },
      ]),
    ])
    const fr = (fake.chatBodies[0].contents[1].parts[0] as any).functionResponse
    expect(fr.response.result).toBe('before\n[Image: x.png]\nafter')
  })

  it('sends a result without a live call after the function responses of the same turn', async () => {
    const { fake, run } = toolTurnAdapter()
    await run([
      { id: 'a1', role: 'assistant', content: [call('c1'), call('c2', false)] },
      result('c2', [{ type: 'text', text: 'unsigned result' }]),
      result('c1', [{ type: 'text', text: 'signed result' }]),
    ])
    const contents = fake.chatBodies[0].contents
    expect(contents.map(content => content.role)).toEqual(['model', 'user', 'user'])
    expect(contents[1].parts).toEqual([
      { functionResponse: { name: 'probe', id: 'c1', response: { result: 'signed result' } } },
    ])
    expect(contents[2].parts).toEqual([{ text: 'unsigned result' }])
  })

  it('keeps responses to one model turn together across an empty assistant message', async () => {
    const { fake, run } = toolTurnAdapter()
    await run([
      { id: 'a1', role: 'assistant', content: [call('c1'), call('c2')] },
      result('c1', [{ type: 'text', text: 'one' }]),
      { id: 'a2', role: 'assistant', content: [{ type: 'text', text: '' }] },
      result('c2', [{ type: 'text', text: 'two' }]),
    ])
    const contents = fake.chatBodies[0].contents
    expect(contents.map(content => content.role)).toEqual(['model', 'user'])
    expect(contents[1].parts).toHaveLength(2)
  })

  it('starts a new response turn after the next model turn', async () => {
    const { fake, run } = toolTurnAdapter()
    await run([
      { id: 'a1', role: 'assistant', content: [call('c1')] },
      result('c1', [{ type: 'text', text: 'one' }]),
      { id: 'a2', role: 'assistant', content: [call('c2')] },
      result('c2', [{ type: 'text', text: 'two' }]),
    ])
    const contents = fake.chatBodies[0].contents
    expect(contents.map(content => content.role)).toEqual(['model', 'user', 'model', 'user'])
  })

  it('converts tool result with multiple image blocks to multiple inlineData parts', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'Inspected multiple images' }, { type: 'finish', reason: 'STOP' }] })
    const img1 = Uint8Array.from([0x01, 0x02])
    const img2 = Uint8Array.from([0x03, 0x04])
    const mockAttachments = {
      readImage: async (ref: any) => ({
        ref: { ...ref, mediaType: ref.mediaType ?? 'image/png' },
        data: ref.name === 'first.png' ? img1 : img2,
      }),
    } as any

    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
      resolveAttachments: () => mockAttachments,
    })

    const messages = [
      {
        id: 'a1',
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            id: 'call_multi_img',
            name: 'diff_images',
            arguments: '{}',
            thoughtSignature: 'sig-multi',
          },
        ],
      },
      {
        id: 't1',
        role: 'tool',
        toolCallId: 'call_multi_img',
        content: [
          { type: 'text', text: 'Comparison:' },
          {
            type: 'image',
            attachment: { attachmentId: 'att-1', name: 'first.png', mediaType: 'image/png' },
          },
          {
            type: 'image',
            attachment: { attachmentId: 'att-2', name: 'second.png', mediaType: 'image/png' },
          },
        ],
      },
    ] as any

    await collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages,
      tools: [{ name: 'diff_images', description: 'diff images', parameters: { type: 'object' } }],
    } as any))

    const contents = fake.chatBodies[0].contents
    expect(contents).toHaveLength(2)
    const toolContent = contents[1]
    expect(toolContent.role).toBe('user')
    expect(toolContent.parts).toHaveLength(1)
    const fr = (toolContent.parts[0] as any).functionResponse
    expect(fr.name).toBe('diff_images')
    expect(fr.response.result).toBe('Comparison:')
    expect(fr.parts).toHaveLength(2)
    expect(fr.parts[0].inlineData.data).toBe(Buffer.from(img1).toString('base64'))
    expect(fr.parts[1].inlineData.data).toBe(Buffer.from(img2).toString('base64'))
  })

  it('prunes historical turn images while preserving active user turn images across tool loops and offloaded paths', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'ok' }, { type: 'finish', reason: 'STOP' }] })
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const mockAttachments = {
      readImage: async (ref: any) => ({
        ref: { ...ref, mediaType: 'image/png' },
        data: pngBytes,
      }),
    } as any
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
      resolveAttachments: () => mockAttachments,
      imageSlidingWindow: true,
      maxFreshImages: 1,
    })

    const messages = [
      {
        id: 'u_old',
        role: 'user',
        content: [
          { type: 'image', attachment: { attachmentId: 'old-1', name: 'old.png' } },
          { type: 'image', attachment: { attachmentId: 'off-1', name: 'saved.png' }, offloaded: true },
        ],
      },
      { id: 'a_old', role: 'assistant', content: [{ type: 'text', text: 'seen old' }] },
      {
        id: 'u_active',
        role: 'user',
        content: [
          { type: 'image', attachment: { attachmentId: 'cur-1', name: 'current-a.png' } },
          { type: 'image', attachment: { attachmentId: 'cur-2', name: 'current-b.png' } },
        ],
      },
      {
        id: 'a_tool',
        role: 'assistant',
        content: [{ type: 'tool-call', id: 'c_img', name: 'read_image', arguments: '{}', thoughtSignature: 'sig-1' }],
      },
      {
        id: 't_tool',
        role: 'tool',
        toolCallId: 'c_img',
        content: [{ type: 'image', attachment: { attachmentId: 'tool-1', name: 'tool.png' } }],
      },
    ] as any

    await collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages,
      tools: [{ name: 'read_image', description: 'read', parameters: { type: 'object' } }],
    } as any))

    const contents = fake.chatBodies[0]!.contents
    expect(contents[0]!.parts[0]).toEqual({ text: '[Historical Image: old.png (omitted to preserve context)]' })
    expect((contents[0]!.parts[1] as { text: string }).text).toContain('image omitted to fit request image limits')
    expect('inlineData' in contents[2]!.parts[0]!).toBe(true)
    expect('inlineData' in contents[2]!.parts[1]!).toBe(true)
    expect(((contents[4]!.parts[0] as any).functionResponse.parts ?? [])).toHaveLength(1)
  })

  it('degrades corrupted 8+ byte non-image payloads instead of forwarding invalid inlineData', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'ok' }, { type: 'finish', reason: 'STOP' }] })
    const badBytes = new TextEncoder().encode('not-an-image-header-payload')
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
      resolveAttachments: () => ({
        readImage: async (ref: any) => ({ ref: { ...ref, mediaType: 'image/png' }, data: badBytes }),
      }) as any,
    })

    await collect(adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages: [{
        id: 'u1',
        role: 'user',
        content: [{ type: 'image', attachment: { attachmentId: 'bad-1', name: 'broken.png' } }],
      }],
      tools: [],
    } as any))

    expect(fake.chatBodies[0]!.contents[0]!.parts[0]).toEqual({
      text: '[Image: broken.png (invalid or corrupted image header)]',
    })
  })
})

describe('AntigravityAdapter Argon routing and failover', () => {
  it('passes model to acquire and fails over on 403 PERMISSION_DENIED without marking Flash account dead or leaking usage', async () => {
    const acquiredModels: Array<string | undefined> = []
    const authRejected: string[] = []
    const argonRejected: string[] = []

    const session = {
      thoughtSignatures: new Map<string, string>(),
      acquire: async (opts?: { model?: string }) => {
        acquiredModels.push(opts?.model)
        return {
          oauth,
          accountId: 'acc_flash_only',
          email: 'flash@example.test',
          cca: {
            async *chat(): AsyncIterable<CcaEvent> {
              yield { type: 'usage', usage: { inputTokens: 999, outputTokens: 5 } }
              yield { type: 'functionCall', name: 'search_web', args: { query: 'argon test' } }
              yield { type: 'finish', reason: 'STOP' }
            },
            async *search(): AsyncIterable<CcaEvent> {
              throw new CcaHttpError(403, 'PERMISSION_DENIED: model not allowed')
            },
          },
        }
      },
      noteAuthRejected: (id: string) => { authRejected.push(id) },
      noteArgonRejected: (id: string) => { argonRejected.push(id) },
      findArgonAccount: async (excluded?: ReadonlySet<string> | string) => {
        const set = typeof excluded === 'string' ? new Set([excluded]) : excluded
        if (set?.has('acc_argon')) return undefined
        return { id: 'acc_argon', email: 'argon@example.test', projectId: 'proj-argon', hasArgon: true } as any
      },
      acquireForAccount: async (id: string) => {
        if (id !== 'acc_argon') return undefined
        return {
          oauth,
          accountId: 'acc_argon',
          email: 'argon@example.test',
          cca: {
            async *chat(): AsyncIterable<CcaEvent> {
              yield { type: 'usage', usage: { inputTokens: 100, outputTokens: 20 } }
              yield { type: 'text', text: 'Argon response' }
              yield { type: 'finish', reason: 'STOP' }
            },
            async *search(): AsyncIterable<CcaEvent> {
              yield { type: 'finish', reason: 'STOP' }
            },
          },
        }
      },
    } as unknown as AntigravitySession

    const adapter = createAntigravityAdapter(session, { nativeTools: true, nativeSearch: true })
    const chunks = await collect(adapter.stream({
      ...options('hello argon'),
      model: 'gemini-4-argon',
    }))

    expect(acquiredModels).toEqual(['gemini-4-argon'])
    expect(authRejected).toEqual([])
    expect(argonRejected).toEqual(['acc_flash_only'])
    expect(visibleText(chunks)).toBe('Argon response')
    expect(chunks.find(c => c.type === 'usage')).toEqual({
      type: 'usage',
      usage: { inputTokens: 100, outputTokens: 20 },
    })
  })

  it('routes background compaction and session-title requests to gemini-3.8-flash to save Argon quota (AM1)', async () => {
    const fake = fakeSession({ chat: [{ type: 'text', text: 'Summary' }, { type: 'finish', reason: 'STOP' }] })
    const acquiredModels: string[] = []
    const session = {
      ...fake.session,
      acquire: async (opts?: { model?: string }) => {
        if (opts?.model) acquiredModels.push(opts.model)
        return fake.session.acquire()
      },
    } as unknown as AntigravitySession

    const adapter = createAntigravityAdapter(session, { nativeTools: true, nativeSearch: true })

    // Background compaction request with gemini-4-argon
    await collect(adapter.stream({
      ...options('compact memory'),
      model: 'gemini-4-argon',
      purpose: 'compaction',
    }))

    // Background session-title request with gemini-4-argon
    await collect(adapter.stream({
      ...options('summarize title'),
      model: 'gemini-4-argon',
      purpose: 'session-title',
    }))

    // Regular conversation request with gemini-4-argon
    await collect(adapter.stream({
      ...options('user turn'),
      model: 'gemini-4-argon',
    }))

    // First two background calls should be downgraded to gemini-3.8-flash; third call stays gemini-4-argon
    expect(acquiredModels).toEqual(['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-4-argon'])
  })
})

describe('AntigravitySession switching strategies (R2b)', () => {
  it('rotates across ready accounts when switchingStrategy is round_robin', async () => {
    const store = {
      list: async () => [
        { id: 'acc_1', type: 'oauth', access: 'a1', refresh: 'r1', expires: Date.now() + 600000, projectId: 'p1' },
        { id: 'acc_2', type: 'oauth', access: 'a2', refresh: 'r2', expires: Date.now() + 600000, projectId: 'p2' },
        { id: 'acc_3', type: 'oauth', access: 'a3', refresh: 'r3', expires: Date.now() + 600000, projectId: 'p3' },
      ],
      active: async () => ({ id: 'acc_1', type: 'oauth', access: 'a1', refresh: 'r1', expires: Date.now() + 600000, projectId: 'p1' }),
      setActive: vi.fn(async () => {}),
    } as any

    const session = new AntigravitySession(store)
    vi.spyOn(session, 'getAdvancedSettings').mockResolvedValue({
      defaultReasoningEffort: 'medium',
      modelContextWindow: 1048576,
      switchingStrategy: 'round_robin',
      proactiveThreshold: 20,
    })
    vi.spyOn(session as any, 'refreshGrantForAccount').mockImplementation(async (id: any) => ({
      type: 'oauth', access: `token_${String(id)}`, refresh: `ref_${String(id)}`, expires: Date.now() + 600000, projectId: `proj_${String(id)}`,
    }))

    // First call: starts from acc_1 (active), rotates to acc_2
    const lease1 = await session.acquire()
    expect(lease1?.accountId).toBe('acc_2')
    expect(store.setActive).toHaveBeenCalledWith('acc_2')

    // Second call: active is now acc_2, rotates to acc_3
    store.active = async () => ({ id: 'acc_2', type: 'oauth', access: 'a2', refresh: 'r2', expires: Date.now() + 600000, projectId: 'p2' })
    const lease2 = await session.acquire()
    expect(lease2?.accountId).toBe('acc_3')

    // Third call: active is acc_3, rotates back to acc_1
    store.active = async () => ({ id: 'acc_3', type: 'oauth', access: 'a3', refresh: 'r3', expires: Date.now() + 600000, projectId: 'p3' })
    const lease3 = await session.acquire()
    expect(lease3?.accountId).toBe('acc_1')
  })

  it('keeps active account when switchingStrategy is manual or failover_429', async () => {
    const store = {
      list: async () => [
        { id: 'acc_1', type: 'oauth', access: 'a1', refresh: 'r1', expires: Date.now() + 600000, projectId: 'p1' },
        { id: 'acc_2', type: 'oauth', access: 'a2', refresh: 'r2', expires: Date.now() + 600000, projectId: 'p2' },
      ],
      active: async () => ({ id: 'acc_1', type: 'oauth', access: 'a1', refresh: 'r1', expires: Date.now() + 600000, projectId: 'p1' }),
      setActive: vi.fn(async () => {}),
    } as any

    const session = new AntigravitySession(store)
    vi.spyOn(session, 'getAdvancedSettings').mockResolvedValue({
      defaultReasoningEffort: 'medium',
      modelContextWindow: 1048576,
      switchingStrategy: 'manual',
      proactiveThreshold: 20,
    })
    vi.spyOn(session as any, 'refreshGrantForAccount').mockImplementation(async (id: any) => ({
      type: 'oauth', access: `token_${String(id)}`, refresh: `ref_${String(id)}`, expires: Date.now() + 600000, projectId: `proj_${String(id)}`,
    }))

    const lease = await session.acquire()
    expect(lease?.accountId).toBe('acc_1')
    expect(store.setActive).not.toHaveBeenCalled()
  })

  it('rotates across multiple Argon accounts when switchingStrategy is round_robin', async () => {
    const store = {
      list: async () => [
        { id: 'acc_flash', type: 'oauth', access: 'af', refresh: 'rf', expires: Date.now() + 600000, projectId: 'pf', hasArgon: false },
        { id: 'acc_argon_1', type: 'oauth', access: 'a1', refresh: 'r1', expires: Date.now() + 600000, projectId: 'p1', hasArgon: true },
        { id: 'acc_argon_2', type: 'oauth', access: 'a2', refresh: 'r2', expires: Date.now() + 600000, projectId: 'p2', hasArgon: true },
      ],
      active: async () => ({ id: 'acc_argon_1', type: 'oauth', access: 'a1', refresh: 'r1', expires: Date.now() + 600000, projectId: 'p1', hasArgon: true }),
      setActive: vi.fn(async () => {}),
    } as any

    const session = new AntigravitySession(store)
    vi.spyOn(session, 'getAdvancedSettings').mockResolvedValue({
      defaultReasoningEffort: 'medium',
      modelContextWindow: 1048576,
      switchingStrategy: 'round_robin',
      proactiveThreshold: 20,
    })
    vi.spyOn(session as any, 'refreshGrantForAccount').mockImplementation(async (id: any) => ({
      type: 'oauth', access: `token_${String(id)}`, refresh: `ref_${String(id)}`, expires: Date.now() + 600000, projectId: `proj_${String(id)}`,
    }))

    const lease1 = await session.acquire({ model: 'gemini-4-argon' })
    expect(lease1?.accountId).toBe('acc_argon_2')
    expect(store.setActive).toHaveBeenCalledWith('acc_argon_2')

    store.active = async () => ({ id: 'acc_argon_2', type: 'oauth', access: 'a2', refresh: 'r2', expires: Date.now() + 600000, projectId: 'p2', hasArgon: true })
    const lease2 = await session.acquire({ model: 'gemini-4-argon' })
    expect(lease2?.accountId).toBe('acc_argon_1')
    expect(store.setActive).toHaveBeenCalledWith('acc_argon_1')
  })
})
