import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { describe, expect, it } from 'vitest'
import { createAntigravityAdapter } from '../src/adapter.ts'
import { QUOTA_SUMMARY_PATH, TOKEN_URL } from '../src/ids.ts'
import { AntigravitySession } from '../src/session.ts'
import { AntigravityCredentialStore } from '../src/store.ts'
import type { AntigravityGrant, CcaEvent, ChatGenerateInput, GeminiPart } from '../src/types.ts'

function createFakeAdapterSession(signatures?: Map<string, string>) {
  const chatBodies: ChatGenerateInput[] = []
  const thoughtSignatures = signatures ?? new Map<string, string>()
  const cca = {
    async *chat(_oauth: unknown, input: ChatGenerateInput): AsyncIterable<CcaEvent> {
      chatBodies.push(input)
      yield { type: 'text', text: 'response text' }
      yield { type: 'finish', reason: 'STOP' }
    },
    async *search(): AsyncIterable<CcaEvent> {
      yield { type: 'text', text: 'search text' }
      yield { type: 'finish', reason: 'STOP' }
    },
  }
  const session = {
    thoughtSignatures,
    acquire: async () => ({
      oauth: {
        type: 'oauth' as const,
        access: 'mock-access-token',
        refresh: 'mock-refresh-token',
        expires: Date.now() + 3_600_000,
        projectId: 'mock-project-id',
      },
      accountId: 'acc_test_1',
      email: 'test@example.com',
      cca,
    }),
    cca,
  } as unknown as AntigravitySession
  return { session, chatBodies, thoughtSignatures }
}

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

async function createTempStore() {
  const baseDir = tmpdir()
  const dir = await mkdtemp(join(baseDir, 'agy-test-')).catch(async () => {
    const fallbackDir = join(process.cwd(), 'temp')
    await mkdir(fallbackDir, { recursive: true })
    return await mkdtemp(join(fallbackDir, 'agy-test-'))
  })
  const store = new AntigravityCredentialStore(join(dir, 'auth.json'))
  return {
    store,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    },
  }
}

describe('Orphaned tool result and duplicate functionCall ID pairing', () => {
  it('degrades an orphaned tool result with no prior functionCall to user text and does not throw', async () => {
    const fake = createFakeAdapterSession()
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })

    const options: GenerateOptions = {
      provider: 'agy-google-antigravity',
      model: 'gemini-3.7-flash',
      messages: [
        {
          id: 'u1',
          role: 'user',
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'Please inspect the state.' }],
        },
        {
          id: 't_orphan',
          role: 'tool',
          source: { kind: 'tool', callId: 'call_orphan_999' },
          toolCallId: 'call_orphan_999',
          content: [{ type: 'text', text: 'Orphaned output from compacted/dropped call' }],
        },
      ],
      tools: [{ name: 'read_file', description: 'read file', parameters: { type: 'object' } }],
    } as unknown as GenerateOptions

    await expect(collect(adapter.stream(options))).resolves.toBeDefined()

    expect(fake.chatBodies).toHaveLength(1)
    const contents = fake.chatBodies[0]?.contents ?? []

    const toolContents = contents.filter(c =>
      c.parts.some(p => 'functionResponse' in p),
    )
    expect(toolContents).toHaveLength(0)

    const degradedTurn = contents.find(c =>
      c.role === 'user' &&
      c.parts.some(p => 'text' in p && p.text === 'Orphaned output from compacted/dropped call'),
    )
    expect(degradedTurn).toBeDefined()
    expect(degradedTurn?.parts).toEqual([
      { text: 'Orphaned output from compacted/dropped call' },
    ])
  })

  it('disambiguates duplicate functionCall IDs across assistant turns as id#1, id#2 while preserving thoughtSignature', async () => {
    const fake = createFakeAdapterSession()
    const sharedCallId = 'call_replayed_shared'
    const signature = 'sig-compaction-shadow-xyz'
    fake.thoughtSignatures.set(sharedCallId, signature)

    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })

    const options: GenerateOptions = {
      provider: 'agy-google-antigravity',
      model: 'gemini-3.7-flash',
      messages: [
        {
          id: 'u1',
          role: 'user',
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'Start task' }],
        },
        {
          id: 'a1',
          role: 'assistant',
          source: { kind: 'model', provider: 'agy-google-antigravity', model: 'gemini-3.7-flash' },
          content: [{
            type: 'tool-call',
            id: sharedCallId,
            name: 'read_file',
            arguments: '{"path":"file1.txt"}',
          }],
        },
        {
          id: 't1',
          role: 'tool',
          source: { kind: 'tool', callId: sharedCallId },
          toolCallId: sharedCallId,
          content: [{ type: 'text', text: 'result 1' }],
        },
        {
          id: 'a2',
          role: 'assistant',
          source: { kind: 'model', provider: 'agy-google-antigravity', model: 'gemini-3.7-flash' },
          content: [{
            type: 'tool-call',
            id: sharedCallId,
            name: 'read_file',
            arguments: '{"path":"file2.txt"}',
          }],
        },
        {
          id: 't2',
          role: 'tool',
          source: { kind: 'tool', callId: sharedCallId },
          toolCallId: sharedCallId,
          content: [{ type: 'text', text: 'result 2' }],
        },
        {
          id: 'a3',
          role: 'assistant',
          source: { kind: 'model', provider: 'agy-google-antigravity', model: 'gemini-3.7-flash' },
          content: [{
            type: 'tool-call',
            id: sharedCallId,
            name: 'read_file',
            arguments: '{"path":"file3.txt"}',
          }],
        },
        {
          id: 't3',
          role: 'tool',
          source: { kind: 'tool', callId: sharedCallId },
          toolCallId: sharedCallId,
          content: [{ type: 'text', text: 'result 3' }],
        },
      ],
      tools: [{ name: 'read_file', description: 'read file', parameters: { type: 'object' } }],
    } as unknown as GenerateOptions

    await collect(adapter.stream(options))

    const contents = fake.chatBodies[0]?.contents ?? []

    const functionCalls = contents
      .flatMap(c => c.parts)
      .filter((p): p is Extract<GeminiPart, { functionCall: unknown }> => 'functionCall' in p)

    expect(functionCalls).toHaveLength(3)
    expect(functionCalls[0]?.functionCall.id).toBe(sharedCallId)
    expect(functionCalls[0]?.thoughtSignature).toBe(signature)

    expect(functionCalls[1]?.functionCall.id).toBe(`${sharedCallId}#1`)
    expect(functionCalls[1]?.thoughtSignature).toBe(signature)

    expect(functionCalls[2]?.functionCall.id).toBe(`${sharedCallId}#2`)
    expect(functionCalls[2]?.thoughtSignature).toBe(signature)

    const functionResponses = contents
      .flatMap(c => c.parts)
      .filter((p): p is Extract<GeminiPart, { functionResponse: unknown }> => 'functionResponse' in p)

    expect(functionResponses).toHaveLength(3)
    expect(functionResponses[0]?.functionResponse.id).toBe(sharedCallId)
    expect(functionResponses[0]?.functionResponse.response.result).toBe('result 1')

    expect(functionResponses[1]?.functionResponse.id).toBe(`${sharedCallId}#1`)
    expect(functionResponses[1]?.functionResponse.response.result).toBe('result 2')

    expect(functionResponses[2]?.functionResponse.id).toBe(`${sharedCallId}#2`)
    expect(functionResponses[2]?.functionResponse.response.result).toBe('result 3')
  })

  it('pairs multiple concurrent tool calls within a single assistant message in FIFO order', async () => {
    const fake = createFakeAdapterSession()
    const adapter = createAntigravityAdapter(fake.session, {
      nativeTools: true,
      nativeSearch: true,
    })

    const options: GenerateOptions = {
      provider: 'agy-google-antigravity',
      model: 'gemini-3.7-flash',
      messages: [
        {
          id: 'u1',
          role: 'user',
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'Run multiple commands' }],
        },
        {
          id: 'a1',
          role: 'assistant',
          source: { kind: 'model', provider: 'agy-google-antigravity', model: 'gemini-3.7-flash' },
          content: [
            {
              type: 'tool-call',
              id: 'concurrent_batch',
              name: 'fetch_data',
              arguments: '{"source":"alpha"}',
            },
            {
              type: 'tool-call',
              id: 'concurrent_batch',
              name: 'process_data',
              arguments: '{"step":1}',
            },
            {
              type: 'tool-call',
              id: 'independent_call',
              name: 'log_metric',
              arguments: '{"val":42}',
            },
          ],
        },
        {
          id: 't1',
          role: 'tool',
          source: { kind: 'tool', callId: 'concurrent_batch' },
          toolCallId: 'concurrent_batch',
          content: [{ type: 'text', text: 'alpha payload' }],
        },
        {
          id: 't2',
          role: 'tool',
          source: { kind: 'tool', callId: 'concurrent_batch' },
          toolCallId: 'concurrent_batch',
          content: [{ type: 'text', text: 'step 1 finished' }],
        },
        {
          id: 't3',
          role: 'tool',
          source: { kind: 'tool', callId: 'independent_call' },
          toolCallId: 'independent_call',
          content: [{ type: 'text', text: 'metric recorded' }],
        },
      ],
      tools: [
        { name: 'fetch_data', description: 'fetch', parameters: { type: 'object' } },
        { name: 'process_data', description: 'process', parameters: { type: 'object' } },
        { name: 'log_metric', description: 'log', parameters: { type: 'object' } },
      ],
    } as unknown as GenerateOptions

    await collect(adapter.stream(options))

    const contents = fake.chatBodies[0]?.contents ?? []

    const modelTurn = contents.find(c => c.role === 'model')
    expect(modelTurn).toBeDefined()
    const emittedCalls = modelTurn?.parts.filter(
      (p): p is Extract<GeminiPart, { functionCall: unknown }> => 'functionCall' in p,
    ) ?? []

    expect(emittedCalls).toHaveLength(3)
    expect(emittedCalls[0]?.functionCall).toMatchObject({
      name: 'fetch_data',
      id: 'concurrent_batch',
    })
    expect(emittedCalls[1]?.functionCall).toMatchObject({
      name: 'process_data',
      id: 'concurrent_batch#1',
    })
    expect(emittedCalls[2]?.functionCall).toMatchObject({
      name: 'log_metric',
      id: 'independent_call',
    })

    const responses = contents
      .flatMap(c => c.parts)
      .filter((p): p is Extract<GeminiPart, { functionResponse: unknown }> => 'functionResponse' in p)

    expect(responses).toHaveLength(3)
    expect(responses[0]?.functionResponse).toEqual({
      name: 'fetch_data',
      id: 'concurrent_batch',
      response: { result: 'alpha payload' },
    })
    expect(responses[1]?.functionResponse).toEqual({
      name: 'process_data',
      id: 'concurrent_batch#1',
      response: { result: 'step 1 finished' },
    })
    expect(responses[2]?.functionResponse).toEqual({
      name: 'log_metric',
      id: 'independent_call',
      response: { result: 'metric recorded' },
    })
  })
})

describe('AntigravitySession expired token refresh in retrieveAllQuotas', () => {
  it('properly passes the complete grant to refreshAccessToken and updates grant.refresh on disk', async () => {
    const { store, cleanup } = await createTempStore()
    try {
      const initialGrant: AntigravityGrant = {
        type: 'oauth',
        access: 'stale-access-token',
        refresh: 'initial-valid-refresh-token',
        expires: Date.now() - 30_000,
        projectId: 'test-project-123',
        email: 'developer@example.test',
      }
      await store.add(initialGrant)

      const tokenRequests: Array<{ url: string, bodyParams: Record<string, string> }> = []
      const quotaRequests: Array<{ url: string, authHeader?: string }> = []

      const fetchImpl: typeof fetch = async (input, init) => {
        const url = String(input)
        if (url === TOKEN_URL) {
          const bodyStr = String(init?.body ?? '')
          const params = Object.fromEntries(new URLSearchParams(bodyStr).entries())
          tokenRequests.push({ url, bodyParams: params })

          return Response.json({
            access_token: 'freshly-refreshed-access-token',
            refresh_token: 'rotated-refresh-token-v2',
            expires_in: 3600,
          })
        }

        if (url.includes(QUOTA_SUMMARY_PATH)) {
          const authHeader = init?.headers && 'Authorization' in init.headers
            ? (init.headers as Record<string, string>)['Authorization']
            : undefined
          quotaRequests.push({ url, authHeader })

          return Response.json({
            groups: [
              {
                displayName: 'Code Models',
                buckets: [
                  {
                    bucketId: 'gemini-flash',
                    displayName: 'Flash Quota',
                    window: '5h',
                    remainingFraction: 0.95,
                  },
                ],
              },
            ],
          })
        }

        return new Response('', { status: 404 })
      }

      const session = new AntigravitySession(store, fetchImpl)

      const quotas = await session.retrieveAllQuotas()

      expect(tokenRequests).toHaveLength(1)
      expect(tokenRequests[0]?.bodyParams['grant_type']).toBe('refresh_token')
      expect(tokenRequests[0]?.bodyParams['refresh_token']).toBe('initial-valid-refresh-token')

      expect(quotaRequests.length).toBeGreaterThanOrEqual(1)
      expect(quotaRequests[0]?.authHeader).toBe('Bearer freshly-refreshed-access-token')

      const accounts = await store.list()
      expect(accounts).toHaveLength(1)
      const updatedAccount = accounts[0]
      expect(updatedAccount?.access).toBe('freshly-refreshed-access-token')
      expect(updatedAccount?.refresh).toBe('rotated-refresh-token-v2')
      expect(updatedAccount?.expires).toBeGreaterThan(Date.now() + 1_000_000)

      const summary = quotas[updatedAccount!.id]
      expect(summary).toBeDefined()
      expect(summary?.ok).toBe(true)
      expect(summary?.groups?.[0]?.buckets?.[0]?.bucketId).toBe('gemini-flash')
      expect(summary?.groups?.[0]?.buckets?.[0]?.remainingFraction).toBe(0.95)
    } finally {
      await cleanup()
    }
  })
})
