import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AntigravityApiServer, AntigravityApiServerStore } from '../src/api-server/index.ts'
import type { AntigravitySession } from '../src/session.ts'
import type { CcaEvent, ChatGenerateInput } from '../src/types.ts'

describe('AntigravityApiServer', () => {
  let tempDir: string
  let storeFile: string
  let store: AntigravityApiServerStore
  let server: AntigravityApiServer | null = null

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'dsh-agy-api-test-'))
    storeFile = join(tempDir, 'api-server.json')
    store = new AntigravityApiServerStore(storeFile)
  })

  afterEach(async () => {
    if (server) {
      await server.stop()
      server = null
    }
    await rm(tempDir, { recursive: true, force: true })
  })

  it('sanitizes default settings and generates API key', async () => {
    const settings = await store.read()
    expect(settings.enabled).toBe(false)
    expect(settings.host).toBe('127.0.0.1')
    expect(settings.port).toBe(18045)
    expect(settings.apiKey).toMatch(/^sk-agy-[0-9a-f]{32}$/)
  })

  it('serves /health, enforces auth, and handles /v1/models & /v1/chat/completions', async () => {
    // Pick a test port
    const testPort = 19145
    const testKey = 'sk-agy-test-secret-1234'
    await store.save({
      enabled: true,
      host: '127.0.0.1',
      port: testPort,
      apiKey: testKey,
    })

    const chatBodies: ChatGenerateInput[] = []
    const fakeCca = {
      async *chat(_oauth: unknown, input: ChatGenerateInput): AsyncIterable<CcaEvent> {
        chatBodies.push(input)
        yield { type: 'thought', text: 'thinking step' }
        yield { type: 'text', text: 'Hello from mock Gemini!' }
        yield { type: 'finish', reason: 'STOP' }
        yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 20 } }
      },
    }

    const fakeSession = {
      getAdvancedSettings: async () => ({
        enabledModels: ['gemini-3.8-flash'],
        defaultReasoningEffort: 'medium',
      }),
      acquire: async () => ({
        oauth: { access: 'tok', projectId: 'p1' },
        accountId: 'acc1',
        cca: fakeCca,
      }),
    } as unknown as AntigravitySession

    server = new AntigravityApiServer(fakeSession, store)
    const status = await server.start()
    expect(status.running).toBe(true)
    expect(status.port).toBe(testPort)

    const baseUrl = `http://127.0.0.1:${testPort}`

    // 1. Health check (no auth needed)
    const healthRes = await fetch(`${baseUrl}/health`)
    expect(healthRes.status).toBe(200)
    const healthJson = await healthRes.json() as any
    expect(healthJson.status).toBe('ok')
    expect(healthJson.models).toEqual(['gemini-3.8-flash'])

    // 2. Auth rejection on /v1/models with wrong key
    const badAuthRes = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: 'Bearer bad-key' },
    })
    expect(badAuthRes.status).toBe(401)
    const badAuthJson = await badAuthRes.json() as any
    expect(badAuthJson.error?.code).toBe('invalid_api_key')

    // 3. Auth success on /v1/models
    const goodAuthRes = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${testKey}` },
    })
    expect(goodAuthRes.status).toBe(200)
    const modelsJson = await goodAuthRes.json() as any
    expect(modelsJson.object).toBe('list')
    expect(modelsJson.data).toHaveLength(1)
    expect(modelsJson.data[0].id).toBe('gemini-3.8-flash')

    // 4. Reject disabled model on chat completions
    const disabledModelRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testKey}`,
      },
      body: JSON.stringify({
        model: 'gemini-3.5-flash',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })
    expect(disabledModelRes.status).toBe(400)
    const disabledJson = await disabledModelRes.json() as any
    expect(disabledJson.error?.code).toBe('model_not_found')

    // 5. Non-streaming chat completion
    const nonStreamRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testKey}`,
      },
      body: JSON.stringify({
        model: 'gemini-3.8-flash',
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello!' },
        ],
      }),
    })
    expect(nonStreamRes.status).toBe(200)
    const nonStreamJson = await nonStreamRes.json() as any
    expect(nonStreamJson.object).toBe('chat.completion')
    expect(nonStreamJson.choices[0].message.content).toBe('Hello from mock Gemini!')
    expect(nonStreamJson.choices[0].message.reasoning_content).toBe('thinking step')
    expect(nonStreamJson.choices[0].finish_reason).toBe('stop')
    expect(chatBodies).toHaveLength(1)
    expect(chatBodies[0].system).toBe('You are helpful.')

    // 6. Streaming chat completion
    const streamRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testKey}`,
      },
      body: JSON.stringify({
        model: 'gemini-3.8-flash',
        stream: true,
        messages: [{ role: 'user', content: 'Stream test' }],
      }),
    })
    expect(streamRes.status).toBe(200)
    const streamText = await streamRes.text()
    expect(streamText).toContain('data: {"id":"chatcmpl-')
    expect(streamText).toContain('thinking step')
    expect(streamText).toContain('Hello from mock Gemini!')
    expect(streamText).toContain('data: [DONE]')
  })
  it('accepts effort-suffixed ids and fails over from a banned account before any header is sent', async () => {
    const testPort = 19146
    const testKey = 'sk-agy-test-secret-5678'
    await store.save({ enabled: true, host: '127.0.0.1', port: testPort, apiKey: testKey })
    const chatBodies: { account: string, input: ChatGenerateInput }[] = []
    const ccaFor = (account: string) => ({
      async *chat(_oauth: unknown, input: ChatGenerateInput): AsyncIterable<CcaEvent> {
        chatBodies.push({ account, input })
        if (account === 'banned') throw new Error('CCA 403: {"status":"PERMISSION_DENIED","reason":"TOS_VIOLATION"}')
        yield { type: 'text', text: 'ok from ' + account }
        yield { type: 'finish', reason: 'STOP' }
      },
    })
    const banned: string[] = []
    let next = 'banned'
    const fakeSession = {
      getAdvancedSettings: async () => ({ enabledModels: ['gemini-3.8-flash'], defaultReasoningEffort: 'medium' }),
      acquire: async () => {
        const account = next
        next = 'healthy'
        return { oauth: { access: 'tok', projectId: 'p1' }, accountId: account, cca: ccaFor(account) }
      },
      noteBanned: async (id: string) => { banned.push(id) },
      noteRateLimited: () => {},
    } as unknown as AntigravitySession

    server = new AntigravityApiServer(fakeSession, store)
    await server.start()
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${testKey}` },
      body: JSON.stringify({ model: 'gemini-3.8-flash-low', stream: true, messages: [{ role: 'user', content: 'hi' }] }),
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('ok from healthy')
    expect(banned).toEqual(['banned'])
    expect(chatBodies.map(b => b.account)).toEqual(['banned', 'healthy'])
    expect(chatBodies[1]!.input.model).toBe('gemini-3.8-flash-low')

    const unknown = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${testKey}` },
      body: JSON.stringify({ model: 'gemini-3.7-flash-low', messages: [{ role: 'user', content: 'hi' }] }),
    })
    expect(unknown.status).toBe(400)
  })

  it('only accepts IP literals or localhost as the bind host', async () => {
    expect((await store.save({ host: '172.17.0.1' })).host).toBe('172.17.0.1')
    expect((await store.save({ host: 'evil.example.com' })).host).toBe('127.0.0.1')
  })
  it('follows the Official CLI route: no direct account, effort from the model suffix, tool calls returned', async () => {
    const testPort = 19147
    const testKey = 'sk-agy-test-secret-agy'
    await store.save({ enabled: true, host: '127.0.0.1', port: testPort, apiKey: testKey })
    const agyPath = join(tempDir, 'agy')
    await writeFile(agyPath, `#!/usr/bin/env node
const fs = require('node:fs')
let input = ''
process.stdin.on('data', c => { input += c })
process.stdin.on('end', () => {
  fs.writeFileSync(process.cwd() + '/seen.json', JSON.stringify({ args: process.argv.slice(2), input }))
  console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'Calling.\\n<tool_call name="get_weather">{"city":"Paris"}</tool_call>', usage: { input_tokens: 7, output_tokens: 3 } } }))
})
`)
    await chmod(agyPath, 0o755)
    let acquired = 0
    const fakeSession = {
      store: { filename: join(tempDir, 'auth.json') },
      manager: { read: async () => ({ route: 'agy', enabled: false, baseUrl: '', apiKey: '', agyPath }) },
      getAdvancedSettings: async () => ({ enabledModels: ['gemini-3.8-flash'], defaultReasoningEffort: 'medium' }),
      acquire: async () => { acquired += 1; return undefined },
    } as unknown as AntigravitySession
    server = new AntigravityApiServer(fakeSession, store)
    await server.start()
    const request = (stream: boolean) => fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${testKey}` },
      body: JSON.stringify({
        model: 'gemini-3.8-flash-low',
        stream,
        messages: [{ role: 'system', content: 'Be brief.' }, { role: 'user', content: 'Weather in Paris?' }],
        tools: [{ type: 'function', function: { name: 'get_weather', description: 'Weather', parameters: { type: 'object' } } }],
      }),
    })
    const json = await (await request(false)).json() as any
    expect(json.choices[0].message.content).toBe('Calling.')
    expect(json.choices[0].message.tool_calls[0].function).toEqual({ name: 'get_weather', arguments: '{"city":"Paris"}' })
    expect(json.choices[0].finish_reason).toBe('tool_calls')
    expect(json.usage.prompt_tokens).toBe(7)
    const streamed = await (await request(true)).text()
    expect(streamed).toContain('"content":"Calling."')
    expect(streamed).toContain('"finish_reason":"tool_calls"')
    expect(acquired).toBe(0)
    const seen = JSON.parse(await readFile(join(tempDir, '.dsh-antigravity-oauth.agy-workspace', 'seen.json'), 'utf8')) as { args: string[], input: string }
    expect(seen.args.join(' ')).toContain('--model gemini-3.8-flash --effort low')
    expect(JSON.parse(seen.input).message.content).toContain('<user>\nWeather in Paris?\n</user>')
  })

  it('follows the Gateway route by relaying the request with the wire model id', async () => {
    const testPort = 19148
    const testKey = 'sk-agy-test-secret-gw'
    await store.save({ enabled: true, host: '127.0.0.1', port: testPort, apiKey: testKey })
    let seen: { auth?: string, model?: string } = {}
    const gateway = createServer((req, res) => {
      let raw = ''
      req.on('data', c => { raw += c })
      req.on('end', () => {
        seen = { auth: req.headers.authorization, model: JSON.parse(raw).model }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'from gateway' } }] }))
      })
    })
    await new Promise<void>(resolve => gateway.listen(19149, '127.0.0.1', resolve))
    try {
      const fakeSession = {
        manager: { read: async () => ({ route: 'gateway', enabled: true, baseUrl: 'http://127.0.0.1:19149/v1', apiKey: 'gw-key', agyPath: '' }) },
        getAdvancedSettings: async () => ({ enabledModels: ['gemini-3.8-flash'], defaultReasoningEffort: 'medium' }),
        acquire: async () => { throw new Error('must not acquire a direct account') },
      } as unknown as AntigravitySession
      server = new AntigravityApiServer(fakeSession, store)
      await server.start()
      const res = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${testKey}` },
        body: JSON.stringify({ model: 'gemini-3.8-flash-low', messages: [{ role: 'user', content: 'hi' }] }),
      })
      expect(((await res.json()) as any).choices[0].message.content).toBe('from gateway')
      expect(seen).toEqual({ auth: 'Bearer gw-key', model: 'gemini-3.8-flash-low' })
    } finally {
      await new Promise(resolve => gateway.close(resolve))
    }
  })
})
