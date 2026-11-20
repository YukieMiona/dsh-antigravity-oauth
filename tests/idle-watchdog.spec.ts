import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import { describe, expect, it } from 'vitest'
import { createAntigravityAdapter } from '../src/adapter.ts'
import type { AntigravitySession } from '../src/session.ts'
import type { CcaEvent } from '../src/types.ts'

type Script = (signal: AbortSignal | undefined) => AsyncIterable<CcaEvent>

function waitUntilAborted(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (signal === undefined) return
    if (signal.aborted) reject(signal.reason)
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function adapterWith(script: Script, idleMs: number) {
  let calls = 0
  const cca = {
    chat(_oauth: unknown, _input: unknown, signal?: AbortSignal) {
      calls += 1
      return script(signal)
    },
  }
  const session = {
    thoughtSignatures: new Map<string, string>(),
    acquire: async () => ({ oauth: { access: 't' }, accountId: 'acc', email: 'e@example.test', cca }),
    cca,
  } as unknown as AntigravitySession
  const adapter = createAntigravityAdapter(session, { nativeTools: true, nativeSearch: true, streamIdleTimeoutMs: idleMs })
  const run = async () => {
    const chunks: StreamChunk[] = []
    for await (const chunk of adapter.stream({
      provider: 'agy-google-antigravity',
      model: 'gemini-3.8-flash',
      messages: [{ id: 'u1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'hi' }] }],
      tools: [],
    } as any)) chunks.push(chunk)
    return chunks
  }
  return { run, calls: () => calls }
}

describe('Antigravity stream idle watchdog', () => {
  it('times out a stream that sends nothing', async () => {
    const { run } = adapterWith(async function* (signal) {
      await waitUntilAborted(signal)
    }, 50)
    await expect(run()).rejects.toMatchObject({ code: 'TIMEOUT' })
  })

  it('times out a stream that stalls after some text, without a retry', async () => {
    const { run, calls } = adapterWith(async function* (signal) {
      yield { type: 'text', text: 'partial' }
      await waitUntilAborted(signal)
    }, 50)
    await expect(run()).rejects.toMatchObject({ code: 'TIMEOUT' })
    expect(calls()).toBe(1)
  })

  it('keeps a long stream that sends events within the idle time', async () => {
    const { run } = adapterWith(async function* () {
      for (let index = 0; index < 8; index += 1) {
        await sleep(30)
        yield { type: 'text', text: String(index) }
      }
      yield { type: 'finish', reason: 'STOP' }
    }, 80)
    const chunks = await run()
    const text = chunks.filter(chunk => chunk.type === 'text-delta').map(chunk => (chunk as { text: string }).text).join('')
    expect(text).toBe('01234567')
  })
})
