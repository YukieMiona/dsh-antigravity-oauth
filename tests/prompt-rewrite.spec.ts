import { describe, expect, it } from 'vitest'
import { BUILTIN_PROMPT_REWRITES, rewriteRequest, rewritesFor, rewriteText } from '../src/agy/prompt-rewrite.ts'

// The three DSH sentences that bisection found on 2026-11-25 (DSH 0.2.3-alpha.2 web prompt).
const IDENTITY = 'You are an AI agent powered by DeepSeek Harness.'
const BROWSER = 'The browser provides no implicit DOM, route, or screenshot context.'
const HMR = 'The client-plugin HMR receiver is active, but client-plugin changes reload without a refresh only while `pnpm run dev:web` is also running from this same checkout to rebuild their bundles; verify that watcher before promising automatic updates.'

describe('prompt rewrite', () => {
  it('rewords each built-in sentence and leaves the rest alone', () => {
    const text = `${IDENTITY}\n\nYou are a coding agent.\n\n${BROWSER} ${HMR} Every other change needs a rebuild.`
    const out = rewriteText(text, BUILTIN_PROMPT_REWRITES)
    expect(out.count).toBe(3)
    expect(out.text).not.toContain('DeepSeek Harness')
    expect(out.text).not.toContain(BROWSER)
    expect(out.text).not.toContain('HMR receiver')
    expect(out.text).toContain('You are a coding agent.')
    expect(out.text).toContain('Every other change needs a rebuild.')
    // Running the rules again changes nothing.
    expect(rewriteText(out.text, BUILTIN_PROMPT_REWRITES).count).toBe(0)
  })

  it('changes system instructions only, never user or assistant content', () => {
    const { request, count } = rewriteRequest({
      system: IDENTITY,
      messages: [
        { role: 'system', content: [{ type: 'text', text: BROWSER }] },
        { role: 'user', content: [{ type: 'text', text: `Please explain: ${IDENTITY}` }] },
      ],
    } as never, BUILTIN_PROMPT_REWRITES)
    expect(count).toBe(2)
    expect(request.system).toBe('You are an AI agent.')
    expect((request.messages[0]!.content[0] as { text: string }).text).not.toContain(BROWSER)
    expect((request.messages[1]!.content[0] as { text: string }).text).toContain(IDENTITY)
  })

  it('applies nothing while the switch is off, and adds the extra rules when it is on', () => {
    expect(rewritesFor({ agyPromptRewrite: false, agyPromptRewrites: [{ find: 'a', replace: 'b' }] })).toEqual([])
    const rules = rewritesFor({ agyPromptRewrite: true, agyPromptRewrites: [{ find: 'secret phrase', replace: 'other words' }] })
    expect(rules).toHaveLength(BUILTIN_PROMPT_REWRITES.length + 1)
    expect(rewriteText('a secret phrase here, secret phrase', rules)).toEqual({ text: 'a other words here, other words', count: 2 })
  })
})
