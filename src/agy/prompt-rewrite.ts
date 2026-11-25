import type { GenerateOptions } from '@deepseek-ai/dsh-llm'

/**
 * Google's Antigravity backend answers 429 RESOURCE_EXHAUSTED, with quota left, to requests whose
 * system prompt carries certain sentences of known third-party harnesses (community reports for
 * Claude Code, Hermes Agent and omp; see the CHANGELOG). Measured on 2026-11-25 with one account and
 * gemini-4-neon-medium: DSH's prompt failed on every request, a neutral prompt passed before and
 * after, and bisection found three stock DSH sentences. With these three rewritten, the same
 * 185K-character prompt was answered. The matched text moves over time, so the owner can add rules
 * in the route settings file (`agyPromptRewrites`). Off unless the route setting turns it on.
 */
export interface PromptRewrite {
  find: string | RegExp
  replace: string
}

export const BUILTIN_PROMPT_REWRITES: readonly PromptRewrite[] = [
  { find: 'You are an AI agent powered by DeepSeek Harness.', replace: 'You are an AI agent.' },
  {
    find: 'The browser provides no implicit DOM, route, or screenshot context.',
    replace: 'No page content, route or screen image comes with a message from the browser.',
  },
  {
    find: /The client-plugin HMR receiver is active, but client-plugin changes reload without a refresh only while `[^`]*` is also running from this same checkout to rebuild their bundles; verify that watcher before promising automatic updates\./g,
    replace: 'Changes to client plugins appear in the open page without a refresh only while the web development build runs from this checkout; check that it runs before you promise this.',
  },
]

/** The rules a request on the agy route gets from the route settings; empty when the switch is off. */
export function rewritesFor(settings: { agyPromptRewrite?: boolean, agyPromptRewrites?: ReadonlyArray<{ find: string, replace: string }> }): PromptRewrite[] {
  if (settings.agyPromptRewrite !== true) return []
  return [...BUILTIN_PROMPT_REWRITES, ...(settings.agyPromptRewrites ?? [])]
}

/** Apply the rules to one text; returns the text and the number of replacements. */
export function rewriteText(text: string, rules: readonly PromptRewrite[]): { text: string, count: number } {
  let count = 0
  let out = text
  for (const rule of rules) {
    if (typeof rule.find === 'string') {
      if (rule.find.length === 0) continue
      const parts = out.split(rule.find)
      count += parts.length - 1
      out = parts.join(rule.replace)
    } else {
      const pattern = rule.find.global ? rule.find : new RegExp(rule.find.source, rule.find.flags + 'g')
      out = out.replace(pattern, () => { count += 1; return rule.replace })
    }
  }
  return { text: out, count }
}

type Request = Pick<GenerateOptions, 'messages' | 'system' | 'tools' | 'purpose'>

/**
 * The request with the rules applied to its system instructions only: `system` and the text of
 * system-role messages. User, assistant and tool content are never changed.
 */
export function rewriteRequest(request: Request, rules: readonly PromptRewrite[]): { request: Request, count: number } {
  if (rules.length === 0) return { request, count: 0 }
  let count = 0
  const fix = (text: string): string => {
    const result = rewriteText(text, rules)
    count += result.count
    return result.text
  }
  const system = request.system === undefined ? undefined : fix(request.system)
  const messages = request.messages.map(message => message.role !== 'system'
    ? message
    : { ...message, content: message.content.map(block => block.type === 'text' ? { ...block, text: fix(block.text) } : block) })
  return { request: { ...request, messages, ...system === undefined ? {} : { system } }, count }
}
