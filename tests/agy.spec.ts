import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildConversation,
  buildTemplateBody,
  clipMiddle,
  estimateTokens,
  parseAnswer,
  splitConversation,
  ToolCallFilter,
} from '../src/agy/prompt.ts'
import { AgyError, agyArgs, agyEnv, agySettings, checkAgy, classifyRateLimit, forgetConversation, formatWait, holdAfter, parseAgyQuota, parseDuration, quotaRetryAfter, rateLimitRetryAfter, resetCapacityCooldown, runAgy, setMemoryProbe, streamAgy } from '../src/agy/run.ts'
import { checkAgyWatch, isQuotaLow, resetAgyWatch } from '../src/agy/quota-watch.ts'
import { agyTurn } from '../src/agy/turn.ts'
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
    expect(estimateTokens(text)).toBeLessThan(1_000)
    expect(text).toContain('bytes omitted')
    expect(text).toContain('TAIL')
  })

  it('moves older turns to the template part before omitting anything', () => {
    const turn = (n: number) => msg('user', [{ type: 'text', text: `turn ${n} ` + 'x'.repeat(380) }])
    // Each turn is about 123 tokens.
    const parts = splitConversation([turn(1), turn(2), turn(3), turn(4)] as never, 150, 300)
    expect(parts.recent).toContain('turn 4')
    expect(parts.recent).toContain('Earlier turns of this conversation are in your instructions')
    expect(parts.earlier).toContain('turn 3')
    expect(parts.earlier).toContain('turn 2')
    expect(parts.earlier.startsWith('[1 oldest turn(s) omitted')).toBe(true)
    expect(parts.earlier).not.toContain('turn 1 ')
  })

  it('estimates tokens conservatively for English, code and Chinese', () => {
    // Measured on agy: 3.9 bytes per token for English, 3.45 for code, about 1 token per Chinese character.
    expect(estimateTokens('a'.repeat(3_900))).toBeGreaterThanOrEqual(1_000)
    expect(estimateTokens('const x = 1;\n'.repeat(300))).toBeGreaterThanOrEqual(Math.ceil(13 * 300 / 3.45))
    expect(estimateTokens('的'.repeat(1_000))).toBeGreaterThanOrEqual(1_000)
    expect(estimateTokens('😀')).toBe(2)
  })

  it("gives the recent part's unused tokens to the earlier part", () => {
    const turn = (n: number) => msg('user', [{ type: 'text', text: `turn ${n} ` + 'x'.repeat(380) }])
    const parts = splitConversation([turn(1), turn(2), turn(3)] as never, 150, used => 400 - used)
    expect(parts.earlier).toContain('turn 2')
    expect(parts.earlier).toContain('turn 1')
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
  afterEach(async () => {
    resetCapacityCooldown()
    resetAgyWatch()
    setMemoryProbe()
    await rm(dir, { recursive: true, force: true })
  })

  async function fakeAgy(body: string, name = 'agy'): Promise<string> {
    const path = join(dir, name)
    await writeFile(path, `#!/usr/bin/env node\n${body}\n`)
    await chmod(path, 0o755)
    return path
  }

  it('builds locked-down arguments with agent and effort, prompt last', () => {
    const args = agyArgs({ cwd: '/ws', model: 'gemini-3.8-flash', effort: 'low', agent: 'dsh-agy-x' }, '/tmp/run.log')
    expect(args).toContain(agySettings('/ws'))
    expect(args.slice(args.indexOf('--log-file'), args.indexOf('--log-file') + 2)).toEqual(['--log-file', '/tmp/run.log'])
    const closed = JSON.parse(agySettings('/ws'))
    expect(closed.trustedWorkspaces).toEqual(['/ws'])
    expect(closed.toolPermission).toBe('strict')
    expect(closed.permissions.deny).toContain('read_file(*)')
    // An image request may read inside its own folder, and nothing else changes.
    const viewing = JSON.parse(agySettings('/ws/requests/r1', true))
    expect(viewing.trustedWorkspaces).toEqual(['/ws/requests/r1'])
    expect(viewing.permissions.deny).toEqual(['command(*)', 'write_file(*)', 'read_url(*)', 'execute_url(*)', 'mcp(*)'])
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
      { type: 'result', result: { status: 'SUCCESS', response: 'Hello', usage: { input_tokens: 5 }, readsDone: 0, filesRead: [] } },
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

  const RETRYING = `
const fs = require('node:fs')
const log = process.argv[process.argv.indexOf('--log-file') + 1]
process.stdin.resume()
let n = 0
setInterval(() => { n += 1; fs.appendFileSync(log, 'E1115 run.go:316] Run: attempt ' + n + ' failed (REASON), retrying in 1.5s\\n') }, 40)`

  it('gives up when Google keeps refusing the model call, instead of waiting out agy\'s retries', async () => {
    const noCapacity = await fakeAgy(RETRYING.replace('REASON', 'UNAVAILABLE (code 503): No capacity available for model gemini-3.8-flash-low on the server'))
    const started = Date.now()
    await expect(runAgy({ binary: noCapacity, cwd: join(dir, 'ws'), model: 'gemini-3.8-flash', prompt: 'x', maxUpstreamAttempts: 3 }))
      .rejects.toMatchObject({ kind: 'capacity', message: expect.stringContaining('no capacity for gemini-3.8-flash') })
    expect(Date.now() - started).toBeLessThan(5_000)
    const refused = await fakeAgy(RETRYING.replace('REASON', 'PERMISSION_DENIED (code 403): denied'), 'agy-refused')
    await expect(runAgy({ binary: refused, cwd: join(dir, 'ws'), model: 'm', prompt: 'x', maxUpstreamAttempts: 2 })).rejects.toMatchObject({ kind: 'upstream' })
  })

  it('stops at the first 429 and sends nothing to Google, for any model, for 60 s after a short-window limit', async () => {
    const limited = await fakeAgy(RETRYING.replace('REASON', 'RESOURCE_EXHAUSTED (code 429): Resource has been exhausted (e.g. check quota).'), 'agy-429')
    const started = Date.now()
    // agy alone would retry eight times; the plugin stops at the first 429 even with a higher limit.
    await expect(runAgy({ binary: limited, cwd: join(dir, 'ws'), model: 'm', prompt: 'x', maxUpstreamAttempts: 5 })).rejects.toMatchObject({ kind: 'rate-limited', retryAfterMs: 60_000 })
    expect(Date.now() - started).toBeLessThan(4_000)
    const spawned = join(dir, 'spawned-429')
    const ok = await fakeAgy(`require('node:fs').writeFileSync(${JSON.stringify(spawned)}, 'yes'); process.stdin.resume(); process.stdin.on('end', () => console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'ok' } })))`, 'agy-after-429')
    // Every model runs on the one signed-in account, so every model is held back.
    await expect(runAgy({ binary: ok, cwd: join(dir, 'ws'), model: 'other', prompt: 'x' })).rejects.toMatchObject({ kind: 'rate-limited', message: expect.stringContaining('resume in') })
    await expect(readFile(spawned, 'utf8')).rejects.toThrow()
    resetCapacityCooldown()
    await expect(runAgy({ binary: ok, cwd: join(dir, 'ws'), model: 'other', prompt: 'x' })).resolves.toMatchObject({ response: 'ok' })
  })

  it('holds back only the model whose quota is spent, until the reset Google names', async () => {
    const spent = await fakeAgy(RETRYING.replace('REASON', 'RESOURCE_EXHAUSTED (code 429): Individual quota reached. Resets in 3h0m0s'), 'agy-spent')
    await expect(runAgy({ binary: spent, cwd: join(dir, 'ws'), model: 'm', prompt: 'x', maxUpstreamAttempts: 5 })).rejects.toMatchObject({ kind: 'rate-limited', retryAfterMs: 3 * 3_600_000, message: expect.stringContaining('used up') })
    expect(rateLimitRetryAfter()).toBe(0)
    expect(quotaRetryAfter('m')).toBeGreaterThan(3 * 3_600 - 10)
    const ok = await fakeAgy(`process.stdin.resume(); process.stdin.on('end', () => console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'ok' } })))`, 'agy-ok')
    await expect(runAgy({ binary: ok, cwd: join(dir, 'ws'), model: 'm', effort: 'high', prompt: 'x' })).rejects.toMatchObject({ kind: 'rate-limited', message: expect.stringContaining('used up') })
    await expect(runAgy({ binary: ok, cwd: join(dir, 'ws'), model: 'other', prompt: 'x' })).resolves.toMatchObject({ response: 'ok' })
  })

  it('reports the refusal from the log when agy itself gives up', async () => {
    const binary = await fakeAgy(`
const fs = require('node:fs')
process.stdin.resume()
process.stdin.on('end', () => {
  fs.appendFileSync(process.argv[process.argv.indexOf('--log-file') + 1], 'Run: attempt 8 failed (UNAVAILABLE (code 503): No capacity available), retrying in 30s\\n')
  console.log(JSON.stringify({ event: 'result', result: { status: 'ERROR', response: '' } }))
  process.exit(1)
})`)
    await expect(runAgy({ binary, cwd: join(dir, 'ws'), model: 'm', prompt: 'x' })).rejects.toMatchObject({ kind: 'capacity' })
  })

  it('does not wait in the queue for ever: busy after the queue time limit, and an abort leaves the queue', async () => {
    // Little free memory: one run at a time.
    setMemoryProbe(() => 0)
    const slow = await fakeAgy(`process.stdin.resume(); setTimeout(() => console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'slow' } })), 1500)`, 'agy-slow')
    const ok = await fakeAgy(`process.stdin.resume(); process.stdin.on('end', () => console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'ok' } })))`)
    const first = runAgy({ binary: slow, cwd: join(dir, 'ws'), model: 'm', prompt: 'x' })
    await new Promise(resolve => setTimeout(resolve, 50))
    await expect(runAgy({ binary: ok, cwd: join(dir, 'ws'), model: 'm', prompt: 'x', queueTimeoutMs: 100 })).rejects.toMatchObject({ kind: 'busy' })
    const controller = new AbortController()
    const waiting = runAgy({ binary: ok, cwd: join(dir, 'ws'), model: 'm', prompt: 'x', signal: controller.signal })
    setTimeout(() => controller.abort(), 50)
    await expect(waiting).rejects.toMatchObject({ kind: 'aborted' })
    await expect(first).resolves.toMatchObject({ response: 'slow' })
    // Requests that left the queue do not block the ones behind them.
    await expect(runAgy({ binary: ok, cwd: join(dir, 'ws'), model: 'm', prompt: 'x', queueTimeoutMs: 2_000 })).resolves.toMatchObject({ response: 'ok' })
  })

  it('runs a second agy beside the first only while the host has memory to spare', async () => {
    const marker = (name: string) => `
const fs = require('node:fs')
process.stdin.resume()
process.stdin.on('end', () => {
  fs.appendFileSync(${JSON.stringify(join(dir, 'order.log'))}, 'start ${name}\\n')
  setTimeout(() => {
    fs.appendFileSync(${JSON.stringify(join(dir, 'order.log'))}, 'end ${name}\\n')
    console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: '${name}' } }))
  }, 400)
})`
    const a = await fakeAgy(marker('a'), 'agy-a')
    const b = await fakeAgy(marker('b'), 'agy-b')
    const both = async () => {
      await rm(join(dir, 'order.log'), { force: true })
      await Promise.all([
        runAgy({ binary: a, cwd: join(dir, 'ws'), model: 'm', prompt: 'x' }),
        runAgy({ binary: b, cwd: join(dir, 'ws'), model: 'm', prompt: 'x' }),
      ])
      return (await readFile(join(dir, 'order.log'), 'utf8')).trim().split('\n')
    }
    setMemoryProbe(() => 2 * 1024 ** 3)
    expect((await both()).slice(0, 2).sort()).toEqual(['start a', 'start b'])
    setMemoryProbe(() => 100 * 1024 ** 2)
    // One at a time: whichever started first ends before the other starts.
    const serial = await both()
    const first = serial[0]!.slice(-1)
    const second = first === 'a' ? 'b' : 'a'
    expect(serial).toEqual([`start ${first}`, `end ${first}`, `start ${second}`, `end ${second}`])
  })

  it('holds a model back for a short time after Google had no capacity for it', async () => {
    const noCapacity = await fakeAgy(RETRYING.replace('REASON', 'UNAVAILABLE (code 503): No capacity available'), 'agy-busy')
    await expect(runAgy({ binary: noCapacity, cwd: join(dir, 'ws'), model: 'm', effort: 'low', prompt: 'x', maxUpstreamAttempts: 2 })).rejects.toMatchObject({ kind: 'capacity' })
    const spawned = join(dir, 'spawned')
    const ok = await fakeAgy(`require('node:fs').writeFileSync(${JSON.stringify(spawned)}, 'yes'); process.stdin.resume(); process.stdin.on('end', () => console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'ok' } })))`)
    await expect(runAgy({ binary: ok, cwd: join(dir, 'ws'), model: 'm', effort: 'low', prompt: 'x' })).rejects.toMatchObject({ kind: 'capacity', message: expect.stringContaining('next attempt is in') })
    await expect(readFile(spawned, 'utf8')).rejects.toThrow()
    // Another effort is another model on Google's side, so it is not held back.
    await expect(runAgy({ binary: ok, cwd: join(dir, 'ws'), model: 'm', effort: 'high', prompt: 'x' })).resolves.toMatchObject({ response: 'ok' })
    resetCapacityCooldown()
    await expect(runAgy({ binary: ok, cwd: join(dir, 'ws'), model: 'm', effort: 'low', prompt: 'x' })).resolves.toMatchObject({ response: 'ok' })
  })

  it('watches quota and version, and flags a low quota', async () => {
    expect(isQuotaLow({ weekly: 0.5, fiveHour: 0.1 })).toBe(true)
    expect(isQuotaLow({ weekly: 0.1 })).toBe(true)
    expect(isQuotaLow({ weekly: 0.5, fiveHour: 0.5 })).toBe(false)
    const usage = { event: 'command_result', command: { name: 'usage', data: { groups: [
      { name: 'Gemini Models', buckets: [{ window: 'weekly', remaining_fraction: 0.1 }, { window: '5h', remaining_fraction: 0.9 }] },
    ] } } }
    const binary = await fakeAgy(`
const a = process.argv.slice(2)
if (a[0] === '--version') console.log('1.6.0')
else console.log(${JSON.stringify(JSON.stringify(usage))})`)
    const reading = await checkAgyWatch(binary)
    expect(reading).toMatchObject({ weekly: 0.1, fiveHour: 0.9, low: true, version: '1.6.0' })
  })

  const VIEWER = (open: 'all' | 'none' | 'first-twice') => `
const fs = require('node:fs')
let input = ''
process.stdin.on('data', c => { input += c })
process.stdin.on('end', () => {
  const content = JSON.parse(input).message.content
  const files = [...content.matchAll(/\\[Image file: ([^\\]]+)\\]/g)].map(m => m[1])
  const agent = process.argv[process.argv.indexOf('--agent') + 1]
  const template = fs.readFileSync(process.cwd() + '/.agents/agents/' + agent + '.md', 'utf8')
  const report = { cwd: process.cwd(), files, sizes: files.map(f => fs.statSync(f).size), viewer: /tools:\\n  - view_file/.test(template), settings: JSON.parse(process.argv[process.argv.indexOf('--settings') + 1]) }
  ${open === 'all' ? `for (const f of files) console.log(JSON.stringify({ event: 'step_update', step_update: { step_type: 'tool', tool_name: 'read_file', state: 'DONE', tool_info: { name: 'read_file', parameters: { Path: f } } } }))` : ''}
  ${open === 'first-twice' ? `for (const f of files) console.log(JSON.stringify({ event: 'step_update', step_update: { step_type: 'tool', tool_name: 'read_file', state: 'DONE', tool_info: { name: 'read_file', parameters: { Path: files[0] } } } }))` : ''}
  console.log(JSON.stringify({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: JSON.stringify(report) } }))
  console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: JSON.stringify(report) } }))
})`

  it('carries an image as a file in a folder of the request, and removes the folder afterwards', async () => {
    const binary = await fakeAgy(VIEWER('all'))
    const image = { type: 'image', attachment: { name: 'cat.png' } }
    const old = { type: 'image', attachment: { name: 'old.png' } }
    const events = []
    for await (const e of agyTurn({
      binary,
      workspace: join(dir, 'ws'),
      model: 'm',
      request: { messages: [
        msg('user', [old]),
        msg('assistant', [{ type: 'text', text: 'ok' }]),
        msg('user', [{ type: 'text', text: 'What is this?' }, image]),
      ] } as never,
      loadImage: async block => block === image ? { mimeType: 'image/png', data: Buffer.from('PNGDATA') } : '[Historical image: old.png]',
    })) events.push(e)
    const done = events.at(-1) as { type: 'done', text: string }
    const report = JSON.parse(done.text) as { cwd: string, files: string[], sizes: number[], viewer: boolean, settings: any }
    expect(report.files).toEqual([join(report.cwd, 'image-1.png')])
    expect(report.sizes).toEqual([7])
    expect(report.viewer).toBe(true)
    expect(report.cwd.startsWith(join(dir, 'ws', 'requests'))).toBe(true)
    expect(report.settings.trustedWorkspaces).toEqual([report.cwd])
    expect(report.settings.permissions.deny).not.toContain('read_file(*)')
    expect(await readdir(join(dir, 'ws', 'requests'))).toEqual([])
  })

  it('discards an answer about an image that agy never opened, and refuses unsupported images', async () => {
    const binary = await fakeAgy(VIEWER('none'))
    const image = { type: 'image', attachment: { name: 'cat.png' } }
    const turn = (mimeType: string) => (async () => {
      const events = []
      for await (const e of agyTurn({
        binary, workspace: join(dir, 'ws'), model: 'm',
        request: { messages: [msg('user', [{ type: 'text', text: 'What is this?' }, image])] } as never,
        loadImage: async () => ({ mimeType, data: Buffer.from('PNGDATA') }),
      })) events.push(e)
      return events
    })()
    await expect(turn('image/png')).rejects.toMatchObject({ kind: 'image-unread' })
    await expect(turn('image/tiff')).rejects.toMatchObject({ kind: 'image-rejected' })
    expect(await readdir(join(dir, 'ws', 'requests'))).toEqual([])
  })

  it('turns off agy\'s background self-update for every process it starts', async () => {
    expect(agyEnv({ PATH: '/bin' })).toEqual({ PATH: '/bin', AGY_CLI_DISABLE_AUTO_UPDATE: 'true' })
    const binary = await fakeAgy(`
const fs = require('node:fs')
fs.appendFileSync(${JSON.stringify(join(dir, 'env.txt'))}, (process.env.AGY_CLI_DISABLE_AUTO_UPDATE ?? 'unset') + '\\n')
if (process.argv[2] === 'models') console.log('gemini-3.8-flash-low\\tGemini 3.8 Flash (Low)')
else { process.stdin.resume(); process.stdin.on('end', () => console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'ok' } }))) }`)
    await runAgy({ binary, cwd: join(dir, 'ws'), model: 'm', prompt: 'x' })
    await checkAgy(binary)
    const seen = (await readFile(join(dir, 'env.txt'), 'utf8')).trim().split('\n')
    expect(seen.length).toBeGreaterThanOrEqual(2)
    expect(new Set(seen)).toEqual(new Set(['true']))
  })

  it('needs every new image opened: one image opened twice does not count for two', async () => {
    const binary = await fakeAgy(VIEWER('first-twice'), 'agy-twice')
    const a = { type: 'image', attachment: { name: 'a.png' } }
    const b = { type: 'image', attachment: { name: 'b.png' } }
    const run = async () => {
      for await (const _ of agyTurn({
        binary, workspace: join(dir, 'ws'), model: 'm',
        request: { messages: [msg('user', [{ type: 'text', text: 'Compare.' }, a, b])] } as never,
        loadImage: async () => ({ mimeType: 'image/png', data: Buffer.from('PNGDATA') }),
      })) { /* drain */ }
    }
    await expect(run()).rejects.toMatchObject({ kind: 'image-unread', message: expect.stringContaining('1 of 2') })
  })

  it('removes images already written when a later image is rejected', async () => {
    const binary = await fakeAgy(VIEWER('all'), 'agy-reject')
    const good = { type: 'image', attachment: { name: 'good.png' } }
    const bad = { type: 'image', attachment: { name: 'bad.tiff' } }
    const run = async () => {
      for await (const _ of agyTurn({
        binary, workspace: join(dir, 'ws'), model: 'm',
        request: { messages: [msg('user', [good, bad])] } as never,
        loadImage: async block => ({ mimeType: block === good ? 'image/png' : 'image/tiff', data: Buffer.from('DATA') }),
      })) { /* drain */ }
    }
    await expect(run()).rejects.toMatchObject({ kind: 'image-rejected' })
    expect(await readdir(join(dir, 'ws', 'requests'))).toEqual([])
  })

  it('kills agy when it ignores SIGTERM after the consumer stops reading, and frees the slot after it exits', async () => {
    setMemoryProbe(() => 0)
    const stubborn = await fakeAgy(`
process.on('SIGTERM', () => {})
process.stdin.resume()
process.stdin.on('end', () => console.log(JSON.stringify({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: 'hi' } })))
setInterval(() => {}, 1000)`, 'agy-stubborn')
    const ok = await fakeAgy(`process.stdin.resume(); process.stdin.on('end', () => console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'ok' } })))`, 'agy-next')
    for await (const event of streamAgy({ binary: stubborn, cwd: join(dir, 'ws'), model: 'm', prompt: 'x' })) {
      expect(event).toEqual({ type: 'text', text: 'hi' })
      break
    }
    const started = Date.now()
    await expect(runAgy({ binary: ok, cwd: join(dir, 'ws'), model: 'm', prompt: 'x' })).resolves.toMatchObject({ response: 'ok' })
    // The next run waited for the kill after the grace period, so the two never overlapped.
    expect(Date.now() - started).toBeGreaterThan(4_000)
  }, 20_000)

  it('sends fewer earlier turns when agy refuses the input as too large, and gives up after the last try', async () => {
    const sized = (limit: number) => `
const fs = require('node:fs')
process.stdin.resume()
process.stdin.on('end', () => {
  const agent = process.argv[process.argv.indexOf('--agent') + 1]
  const size = fs.statSync(process.cwd() + '/.agents/agents/' + agent + '.md').size
  fs.appendFileSync(${JSON.stringify(join(dir, 'sizes.txt'))}, size + '\\n')
  if (size > ${limit}) {
    console.log(JSON.stringify({ event: 'result', result: { status: 'ERROR', response: '', error: 'agent executor error: generating and executing: serializing trajectory: maxMessageTokens must be positive, got 0' } }))
    process.exit(1)
  }
  console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'fits' } }))
})`
    const turns = Array.from({ length: 60 }, (_, n) => msg(n % 2 === 0 ? 'user' : 'assistant', [{ type: 'text', text: `turn ${n} ` + 'x'.repeat(10_000) }]))
    const run = async (binary: string) => {
      const events = []
      for await (const e of agyTurn({ binary, workspace: join(dir, 'ws'), model: 'm', request: { messages: turns } as never })) events.push(e)
      return events
    }
    const fits = await fakeAgy(sized(300_000), 'agy-sized')
    expect((await run(fits)).at(-1)).toMatchObject({ type: 'done', text: 'fits' })
    const sizes = (await readFile(join(dir, 'sizes.txt'), 'utf8')).trim().split('\n').map(Number)
    expect(sizes.length).toBeGreaterThan(1)
    expect(sizes.at(-1)!).toBeLessThan(sizes[0]!)
    const never = await fakeAgy(sized(1_000), 'agy-never')
    await expect(run(never)).rejects.toMatchObject({ kind: 'too-large' })
  })

  it("deletes the conversation agy saved for a run, unless asked to keep it", async () => {
    const id = '0a1b2c3d-1111-2222-3333-444455556666'
    const app = join(dir, 'home', '.gemini', 'antigravity-cli')
    const make = async () => {
      await mkdir(join(app, 'conversations'), { recursive: true })
      await mkdir(join(app, 'presence'), { recursive: true })
      await mkdir(join(app, 'brain', id), { recursive: true })
      await writeFile(join(app, 'conversations', `${id}.db`), 'db')
      await writeFile(join(app, 'presence', `${id}.lock`), '')
      await writeFile(join(app, 'brain', id, 'note.md'), 'x')
    }
    const exists = (path: string) => stat(path).then(() => true, () => false)
    await make()
    await forgetConversation('../not-an-id', app)
    expect(await exists(join(app, 'conversations', `${id}.db`))).toBe(true)
    await forgetConversation(id, app)
    expect(await exists(join(app, 'conversations', `${id}.db`))).toBe(false)
    expect(await exists(join(app, 'brain', id))).toBe(false)
    expect(await exists(join(app, 'presence', `${id}.lock`))).toBe(false)

    const binary = await fakeAgy(`process.stdin.resume(); process.stdin.on('end', () => console.log(JSON.stringify({ event: 'result', result: { conversation_id: '${id}', status: 'SUCCESS', response: 'ok' } })))`, 'agy-conv')
    const home = process.env.HOME
    process.env.HOME = join(dir, 'home')
    try {
      await make()
      await runAgy({ binary, cwd: join(dir, 'ws'), model: 'm', prompt: 'x', keepConversation: true })
      expect(await exists(join(app, 'conversations', `${id}.db`))).toBe(true)
      await runAgy({ binary, cwd: join(dir, 'ws'), model: 'm', prompt: 'x' })
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(await exists(join(app, 'conversations', `${id}.db`))).toBe(false)
    } finally {
      process.env.HOME = home
    }
  })

  it('checkAgy adds the version and the Gemini quota when the CLI reports them', async () => {
    const usage = { event: 'command_result', command: { name: 'usage', data: { groups: [
      { name: 'Claude and GPT models', buckets: [{ window: 'weekly', remaining_fraction: 0.5 }] },
      { name: 'Gemini Models', buckets: [{ window: 'weekly', remaining_fraction: 0.98, reset_time: '2026-11-21T03:16:14Z' }, { window: '5h', remaining_fraction: 0.99 }] },
    ] } } }
    const binary = await fakeAgy(`
const a = process.argv.slice(2)
if (a[0] === '--version') console.log('1.5.9')
else if (a[0] === 'models') console.log('gemini-3.8-flash-low\\tGemini 3.8 Flash (Low)')
else console.log(${JSON.stringify(JSON.stringify(usage))})`)
    expect(await checkAgy(binary)).toEqual({
      installed: true, signedIn: true, models: ['gemini-3.8-flash-low'], version: '1.5.9',
      quota: { weekly: 0.98, weeklyReset: '2026-11-21T03:16:14Z', fiveHour: 0.99 },
    })
    expect(parseAgyQuota('not json')).toBeUndefined()
  })

  it('checkAgy reads the model list and detects a missing sign-in', async () => {
    const signedIn = await fakeAgy(`console.log('Fetching available models...'); console.log('gemini-3.8-flash-low\\tGemini 3.8 Flash (Low)')`)
    expect(await checkAgy(signedIn)).toEqual({ installed: true, signedIn: true, models: ['gemini-3.8-flash-low'] })
    const signedOut = await fakeAgy(`console.log('Error: Please sign in to view available models.')`)
    expect(await checkAgy(signedOut)).toMatchObject({ installed: true, signedIn: false })
  })
})

describe('429 classes and holds', () => {
  afterEach(() => resetCapacityCooldown())

  it('sorts a 429 into a short-window limit or a spent quota', () => {
    expect(classifyRateLimit('PERMISSION_DENIED (code 403): denied')).toBeUndefined()
    expect(classifyRateLimit('RESOURCE_EXHAUSTED (code 429): Resource has been exhausted (e.g. check quota).')).toEqual({ kind: 'short-window' })
    expect(classifyRateLimit('code 429: Please retry in 3.5s')).toEqual({ kind: 'short-window', delayMs: 3_500 })
    expect(classifyRateLimit('RESOURCE_EXHAUSTED (code 429): {"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"30s"}')).toEqual({ kind: 'short-window', delayMs: 30_000 })
    expect(classifyRateLimit('RESOURCE_EXHAUSTED (code 429): Individual quota reached. Resets in 96h12m27s')).toEqual({ kind: 'quota-spent', delayMs: (96 * 3_600 + 12 * 60 + 27) * 1_000 })
    expect(classifyRateLimit('code 429: You have exhausted your capacity on this model. Your quota will reset after 2h1m5s.')).toEqual({ kind: 'quota-spent', delayMs: (2 * 3_600 + 65) * 1_000 })
    expect(classifyRateLimit('RESOURCE_EXHAUSTED (code 429): QUOTA_EXHAUSTED')).toEqual({ kind: 'quota-spent' })
    // A reset at once is a burst limit, whatever the wording.
    expect(classifyRateLimit('RESOURCE_EXHAUSTED (code 429): quota exhausted, reset after 0s')).toEqual({ kind: 'short-window', delayMs: 0 })
    // A reset far away is a spent quota.
    expect(classifyRateLimit('code 429: retry in 20m0s')).toEqual({ kind: 'quota-spent', delayMs: 20 * 60_000 })
  })

  it('reads Go durations and writes short waits', () => {
    expect(parseDuration('1h2m3.5s')).toBe(3_723_500)
    expect(parseDuration('500ms')).toBe(500)
    expect(parseDuration('soon')).toBeUndefined()
    expect(formatWait(45_000)).toBe('45 s')
    expect(formatWait(12 * 60_000)).toBe('12 min')
    expect(formatWait((3 * 60 + 5) * 60_000)).toBe('3 h 5 min')
    expect(formatWait((4 * 24 + 2) * 3_600_000)).toBe('4 d 2 h')
  })

  it('holds the whole account after a short-window 429: at least 60 s, doubled in a row, at most 5 min', () => {
    const t0 = 1_000_000_000
    expect(holdAfter({ kind: 'short-window', delayMs: 3_000 }, 'm', t0)).toBe(60_000)
    expect(rateLimitRetryAfter(t0)).toBe(60)
    expect(holdAfter({ kind: 'short-window' }, 'm', t0 + 61_000)).toBe(120_000)
    expect(holdAfter({ kind: 'short-window' }, 'm', t0 + 182_000)).toBe(240_000)
    expect(holdAfter({ kind: 'short-window' }, 'm', t0 + 423_000)).toBe(300_000)
    // A long told delay is kept, within the cap.
    expect(holdAfter({ kind: 'short-window', delayMs: 290_000 }, 'm', t0 + 724_000)).toBe(300_000)
    // After a quiet time the row starts again.
    expect(holdAfter({ kind: 'short-window', delayMs: 90_000 }, 'm', t0 + 724_000 + 16 * 60_000)).toBe(90_000)
    expect(quotaRetryAfter('m', t0)).toBe(0)
  })

  it('holds one model after a spent quota, for 30 min when Google names no reset', () => {
    const t0 = 1_000_000_000
    expect(holdAfter({ kind: 'quota-spent' }, 'm', t0)).toBe(30 * 60_000)
    expect(quotaRetryAfter('m', t0)).toBe(30 * 60)
    expect(quotaRetryAfter('other', t0)).toBe(0)
    expect(rateLimitRetryAfter(t0)).toBe(0)
  })
})
