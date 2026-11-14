import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { agyResultChunks, agySchema, buildAgyPrompt } from '../src/agy/prompt.ts'
import { AGY_DENY_ALL_SETTINGS, AgyError, checkAgy, runAgy } from '../src/agy/run.ts'

const tool = { name: 'get_weather', description: 'Weather for a city', parameters: { type: 'object', properties: { city: { type: 'string' } } } }
const msg = (role: string, content: unknown[], extra: Record<string, unknown> = {}) => ({ id: role, role, source: { kind: role }, content, ...extra })

describe('buildAgyPrompt and agySchema', () => {
  it('renders system, tools and the full transcript, and limits tool names in the schema', () => {
    const { prompt, tools } = buildAgyPrompt({
      system: 'Be brief.',
      tools: [tool, { name: 'generate_image', description: 'x', parameters: {} }],
      messages: [
        msg('user', [{ type: 'text', text: 'Weather in Paris?' }]),
        msg('assistant', [{ type: 'tool-call', id: 'c1', name: 'get_weather', arguments: '{"city":"Paris"}' }]),
        msg('tool', [{ type: 'text', text: '14C' }], { toolCallId: 'c1' }),
      ],
    } as unknown as GenerateOptions)
    expect(tools.map(t => t.name)).toEqual(['get_weather'])
    expect(prompt).toContain('<system>\nBe brief.\n</system>')
    expect(prompt).toContain('<tool_call id="c1" name="get_weather">{"city":"Paris"}</tool_call>')
    expect(prompt).toContain('<tool_result id="c1">\n14C\n</tool_result>')
    expect(JSON.stringify(agySchema(tools))).toContain('"enum":["get_weather"]')
  })

  it('sends no tools and no schema for session titles and compaction', () => {
    const { tools } = buildAgyPrompt({ purpose: 'session-title', tools: [tool], messages: [] } as unknown as GenerateOptions)
    expect(tools).toEqual([])
    expect(agySchema(tools)).toBeUndefined()
  })
})

describe('agyResultChunks', () => {
  const ids = (() => { let n = 0; return () => `agy_${n++}` })()
  it('emits closed tool-call blocks and a tool-calls finish', () => {
    const chunks = [...agyResultChunks({ response: '', structured: { kind: 'tool_calls', tool_calls: [{ name: 'get_weather', arguments: { city: 'Paris' } }] }, usage: { input_tokens: 10, output_tokens: 2 } }, 'm', ids)]
    expect(chunks).toContainEqual({ type: 'block-end', index: 0, block: { type: 'tool-call', id: 'agy_0', name: 'get_weather', arguments: '{"city":"Paris"}' } })
    expect(chunks).toContainEqual({ type: 'usage', usage: { inputTokens: 10, outputTokens: 2 } })
    expect(chunks.at(-1)).toEqual({ type: 'finish', reason: { kind: 'tool-calls' } })
  })

  it('uses plain response text without a schema, and reports an empty answer as an error', () => {
    const plain = [...agyResultChunks({ response: 'Hello\n' }, 'm', ids)]
    expect(plain).toContainEqual({ type: 'block-end', index: 0, block: { type: 'text', text: 'Hello' } })
    const empty = [...agyResultChunks({ response: '', structured: { kind: 'answer', text: '' } }, 'm', ids)].at(-1) as StreamChunk & { reason: { kind: string } }
    expect(empty.reason.kind).toBe('error')
  })
})

describe('runAgy against a fake agy binary', () => {
  let dir: string
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'agy-fake-')) })
  afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

  async function fakeAgy(body: string): Promise<string> {
    const path = join(dir, 'agy')
    await writeFile(path, `#!/usr/bin/env node\n${body}\n`)
    await chmod(path, 0o755)
    return path
  }

  it('sends the prompt on stdin with deny-all settings and returns the structured result', async () => {
    const binary = await fakeAgy(`
const fs = require('node:fs')
const args = process.argv.slice(2)
let input = ''
process.stdin.on('data', c => { input += c })
process.stdin.on('end', () => {
  fs.writeFileSync(process.cwd() + '/seen.json', JSON.stringify({ args, input }))
  const event = JSON.parse(input)
  console.log(JSON.stringify({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: 'partial' } }))
  console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'ok', structured_output: { kind: 'answer', text: event.message.content.toUpperCase() }, usage: { input_tokens: 5 } } }))
})`)
    const deltas: string[] = []
    const result = await runAgy({ binary, cwd: join(dir, 'ws'), model: 'gemini-3.8-flash-low', prompt: 'hello', schema: { type: 'object' }, onText: t => deltas.push(t) })
    expect(result).toMatchObject({ status: 'SUCCESS', structured: { kind: 'answer', text: 'HELLO' } })
    expect(deltas).toEqual(['partial'])
    const seen = JSON.parse(await readFile(join(dir, 'ws', 'seen.json'), 'utf8')) as { args: string[], input: string }
    expect(seen.args.slice(-2)).toEqual(['-p', ''])
    expect(seen.args).toContain(AGY_DENY_ALL_SETTINGS)
    expect(seen.args).toContain('--sandbox')
    expect(JSON.parse(seen.input)).toEqual({ event: 'user', message: { content: 'hello' } })
  })

  it('reports a failed run, a missing binary, and an abort as typed errors', async () => {
    const failing = await fakeAgy(`process.stdin.resume(); process.stdin.on('end', () => { console.log(JSON.stringify({ event: 'result', result: { status: 'ERROR', response: '' } })); process.exit(3) })`)
    await expect(runAgy({ binary: failing, cwd: join(dir, 'ws'), model: 'm', prompt: 'x' })).rejects.toMatchObject({ kind: 'failed' })
    await expect(runAgy({ binary: join(dir, 'missing'), cwd: join(dir, 'ws'), model: 'm', prompt: 'x' })).rejects.toMatchObject({ kind: 'not-installed' })
    const slow = await fakeAgy(`process.stdin.resume(); setTimeout(() => {}, 10000)`)
    const controller = new AbortController()
    const run = runAgy({ binary: slow, cwd: join(dir, 'ws'), model: 'm', prompt: 'x', signal: controller.signal })
    setTimeout(() => controller.abort(), 100)
    await expect(run).rejects.toBeInstanceOf(AgyError)
  })

  it('checkAgy reads the model list and detects a missing sign-in', async () => {
    const signedIn = await fakeAgy(`console.log('Fetching available models...'); console.log('gemini-3.8-flash-low\\tGemini 3.8 Flash (Low)')`)
    expect(await checkAgy(signedIn)).toEqual({ installed: true, signedIn: true, models: ['gemini-3.8-flash-low'] })
    const signedOut = await fakeAgy(`console.log('Error: Please sign in to view available models.')`)
    expect(await checkAgy(signedOut)).toMatchObject({ installed: true, signedIn: false })
  })
})
