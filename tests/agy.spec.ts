import { chmod, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildConversation,
  buildTemplateBody,
  clipMiddle,
  parseAnswer,
  ToolCallFilter,
} from '../src/agy/prompt.ts'
import { AGY_DENY_ALL_SETTINGS, AgyError, agyArgs, checkAgy, runAgy, streamAgy } from '../src/agy/run.ts'
import { ensureTemplate, templateDir, templateName } from '../src/agy/template.ts'

const tool = { name: 'get_weather', description: 'Weather for a city', parameters: { type: 'object', properties: { city: { type: 'string' } } } }
const msg = (role: string, content: unknown[], extra: Record<string, unknown> = {}) => ({ id: role, role, source: { kind: role }, content, ...extra })

describe('buildTemplateBody', () => {
  it('carries the system prompt, the tools and the call protocol, without dropped tools', () => {
    const { body, tools } = buildTemplateBody({
      system: 'Be brief.',
      tools: [tool, { name: 'generate_image', description: 'x', parameters: {} }],
      messages: [msg('system', [{ type: 'text', text: 'Loop rules.' }])],
    } as unknown as GenerateOptions)
    expect(tools.map(t => t.name)).toEqual(['get_weather'])
    expect(body).toContain('Be brief.\n\nLoop rules.')
    expect(body).toContain('- get_weather: Weather for a city')
    expect(body).toContain('<tool_call name="TOOL_NAME">')
  })

  it('offers no tools for session titles and compaction', () => {
    const { body, tools } = buildTemplateBody({ purpose: 'session-title', tools: [tool], messages: [] } as unknown as GenerateOptions)
    expect(tools).toEqual([])
    expect(body).not.toContain('How to call tools')
  })
})

describe('buildConversation', () => {
  it('keeps the newest turns within the budget and says how many were omitted', () => {
    const messages = [
      msg('user', [{ type: 'text', text: 'old '.repeat(4000) }]),
      msg('assistant', [{ type: 'tool-call', id: 'c1', name: 'get_weather', arguments: '{"city":"Paris"}' }]),
      msg('tool', [{ type: 'text', text: '14C' }], { toolCallId: 'c1' }),
      msg('user', [{ type: 'text', text: 'latest question' }]),
    ] as unknown as GenerateOptions['messages']
    const text = buildConversation(messages, 2_000)
    expect(text.startsWith('[1 earlier turn(s) omitted')).toBe(true)
    expect(text).toContain('<tool_call name="get_weather">{"city":"Paris"}</tool_call>')
    expect(text).toContain('<tool_result id="c1">\n14C\n</tool_result>')
    expect(text.endsWith('<user>\nlatest question\n</user>')).toBe(true)
  })

  it('clips a single oversized latest turn instead of dropping it', () => {
    const text = buildConversation([msg('user', [{ type: 'text', text: 'a'.repeat(5_000) + 'TAIL' }])] as never, 1_000)
    expect(Buffer.byteLength(text)).toBeLessThan(1_000)
    expect(text).toContain('bytes omitted')
    expect(text).toContain('TAIL')
  })

  it('clipMiddle keeps head and tail', () => {
    const out = clipMiddle('HEAD' + 'x'.repeat(1_000) + 'TAIL', 300)
    expect(out.startsWith('HEAD')).toBe(true)
    expect(out.endsWith('TAIL')).toBe(true)
  })
})

describe('ToolCallFilter and parseAnswer', () => {
  it('streams text but hides tool-call markup, even when the tag is split across deltas', () => {
    const filter = new ToolCallFilter()
    const visible = ['Checking', ' the weather.\n<to', 'ol_call name="get_weather">{"city":', '"Paris"}</tool_call>'].map(d => filter.feed(d)).join('') + filter.end()
    expect(visible).toBe('Checking the weather.\n')
  })

  it('passes a lone "<" that is not a tool tag', () => {
    const filter = new ToolCallFilter()
    expect(filter.feed('a < b') + filter.end()).toBe('a < b')
  })

  it('validates tool names and JSON arguments', () => {
    const parsed = parseAnswer(
      'Sure.\n<tool_call name="get_weather">```json\n{"city":"Paris"}\n```</tool_call>\n<tool_call name="rm_rf">{}</tool_call>\n<tool_call name="get_weather">not json</tool_call>',
      new Set(['get_weather']),
    )
    expect(parsed.text).toBe('Sure.')
    expect(parsed.calls).toEqual([{ name: 'get_weather', arguments: '{"city":"Paris"}' }])
    expect(parsed.rejected).toEqual(['unknown tool "rm_rf"', 'invalid arguments for "get_weather"'])
  })
})

describe('agent templates', () => {
  let dir: string
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'agy-tpl-')) })
  afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

  it('writes one template per body, removing agy defaults, and reuses it', async () => {
    const name = await ensureTemplate(dir, 'BODY')
    expect(name).toBe(templateName('BODY'))
    expect(await ensureTemplate(dir, 'BODY')).toBe(name)
    const text = await readFile(join(templateDir(dir), `${name}.md`), 'utf8')
    expect(text).toContain('excludeDefaultComponents: true')
    expect(text).toContain(`name: ${name}`)
    expect(text.trimEnd().endsWith('BODY')).toBe(true)
  })

  it('keeps only the newest templates', async () => {
    for (let i = 0; i < 20; i++) await ensureTemplate(dir, `body ${i}`)
    expect((await readdir(templateDir(dir))).length).toBe(16)
  })
})

describe('agy runner against a fake binary', () => {
  let dir: string
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'agy-fake-')) })
  afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

  async function fakeAgy(body: string): Promise<string> {
    const path = join(dir, 'agy')
    await writeFile(path, `#!/usr/bin/env node\n${body}\n`)
    await chmod(path, 0o755)
    return path
  }

  it('builds locked-down arguments with agent and effort, prompt last', () => {
    const args = agyArgs({ model: 'gemini-3.8-flash', effort: 'low', agent: 'dsh-agy-x' })
    expect(args).toContain(AGY_DENY_ALL_SETTINGS)
    expect(args).toContain('--sandbox')
    expect(args.slice(args.indexOf('--effort'), args.indexOf('--effort') + 2)).toEqual(['--effort', 'low'])
    expect(args.slice(args.indexOf('--agent'), args.indexOf('--agent') + 2)).toEqual(['--agent', 'dsh-agy-x'])
    expect(args.slice(-2)).toEqual(['-p', ''])
  })

  it('streams text deltas, then the result, with the prompt on stdin', async () => {
    const binary = await fakeAgy(`
const fs = require('node:fs')
let input = ''
process.stdin.on('data', c => { input += c })
process.stdin.on('end', () => {
  fs.writeFileSync(process.cwd() + '/seen.json', input)
  for (const t of ['Hel', 'lo']) console.log(JSON.stringify({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: t } }))
  console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'Hello', usage: { input_tokens: 5 } } }))
})`)
    const events = []
    for await (const e of streamAgy({ binary, cwd: join(dir, 'ws'), model: 'm', prompt: 'hello' })) events.push(e)
    expect(events).toEqual([
      { type: 'text', text: 'Hel' },
      { type: 'text', text: 'lo' },
      { type: 'result', result: { status: 'SUCCESS', response: 'Hello', usage: { input_tokens: 5 } } },
    ])
    expect(JSON.parse(await readFile(join(dir, 'ws', 'seen.json'), 'utf8'))).toEqual({ event: 'user', message: { content: 'hello' } })
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
    // The turn lock is released after an abort, so the next run still starts.
    const ok = await fakeAgy(`process.stdin.resume(); process.stdin.on('end', () => console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'ok' } })))`)
    await expect(runAgy({ binary: ok, cwd: join(dir, 'ws'), model: 'm', prompt: 'x' })).resolves.toMatchObject({ response: 'ok' })
  })

  it('checkAgy reads the model list and detects a missing sign-in', async () => {
    const signedIn = await fakeAgy(`console.log('Fetching available models...'); console.log('gemini-3.8-flash-low\\tGemini 3.8 Flash (Low)')`)
    expect(await checkAgy(signedIn)).toEqual({ installed: true, signedIn: true, models: ['gemini-3.8-flash-low'] })
    const signedOut = await fakeAgy(`console.log('Error: Please sign in to view available models.')`)
    expect(await checkAgy(signedOut)).toMatchObject({ installed: true, signedIn: false })
  })
})
