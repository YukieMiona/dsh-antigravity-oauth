import type { ContentBlock, GenerateOptions, TokenUsage } from '@deepseek-ai/dsh-llm'
import { isDroppedToolName } from '../native-tools.ts'
import type { AgyUsage } from './run.ts'

/**
 * agy is an agent CLI, not a raw model endpoint. The stable part of a DSH request (system prompt,
 * tool list, call protocol) goes into an agent template (template.ts); the conversation goes into
 * the user message. Tool calls come back as `<tool_call name="...">{json}</tool_call>` blocks that
 * are checked against the offered tools before DSH sees them.
 */

type Tool = NonNullable<GenerateOptions['tools']>[number]

/** agy truncates a long user message (verified: 140 KB intact, 200 KB cut), so stay well below. */
export const CONVERSATION_BUDGET_BYTES = 100_000
/** One tool result may not crowd out the rest of the conversation. */
export const TOOL_RESULT_BUDGET_BYTES = 24_000

const OPEN_TAG = '<tool_call'

function textOf(blocks: readonly ContentBlock[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'text' && block.text.length > 0) parts.push(block.text)
    else if (block.type === 'image') {
      parts.push(`[Image: ${block.attachment?.name || block.attachment?.attachmentId || 'image'} (images are not sent through the agy route)]`)
    }
  }
  return parts.join('\n')
}

/** Keep the head and tail of an oversized text, which is where commands and errors usually are. */
export function clipMiddle(text: string, maxBytes: number): string {
  const bytes = Buffer.byteLength(text)
  if (bytes <= maxBytes) return text
  const keep = Math.max(0, maxBytes - 120)
  const head = text.slice(0, Math.floor(keep * 0.7))
  const tail = text.slice(text.length - Math.floor(keep * 0.3))
  return `${head}\n[… ${bytes - Buffer.byteLength(head) - Buffer.byteLength(tail)} bytes omitted …]\n${tail}`
}

export function toolsOf(options: Pick<GenerateOptions, 'tools' | 'purpose'>): Tool[] {
  if (options.purpose === 'compaction' || options.purpose === 'session-title') return []
  return (options.tools ?? []).filter(tool => !isDroppedToolName(tool.name))
}

/** Template body: role, DSH system instructions, tools, and the call protocol. */
export function buildTemplateBody(options: Pick<GenerateOptions, 'messages' | 'system' | 'tools' | 'purpose'>): { body: string, tools: Tool[] } {
  const tools = toolsOf(options)
  const system = [options.system ?? '', ...options.messages.filter(m => m.role === 'system').map(m => textOf(m.content))]
    .map(text => text.trim()).filter(text => text.length > 0).join('\n\n')
  const out: string[] = [
    'You are the language model behind the DSH agent harness. DSH owns the conversation, runs every tool and handles approvals. You have no tools of your own and never try to call any.',
    'The conversation arrives in the user message as tagged turns. Write the next assistant turn.',
  ]
  if (system.length > 0) out.push('# DSH system instructions', system)
  if (tools.length > 0) {
    out.push('# Tools DSH can run for you')
    for (const tool of tools) out.push(`- ${tool.name}: ${tool.description}\n  parameters: ${JSON.stringify(tool.parameters)}`)
    out.push(
      '# How to call tools',
      'To have DSH run a tool, write one block per call after any text you want the user to see:',
      '<tool_call name="TOOL_NAME">{"argument": "value"}</tool_call>',
      'The block body is one JSON object matching that tool\'s parameters. Use only tool names listed above. '
        + 'After your tool calls, stop: DSH runs them and sends the results in the next turn. If no tool is needed, just answer.',
    )
  }
  return { body: out.join('\n\n'), tools }
}

function renderMessage(message: GenerateOptions['messages'][number]): string | undefined {
  if (message.role === 'user') return `<user>\n${textOf(message.content)}\n</user>`
  if (message.role === 'assistant') {
    const pieces: string[] = []
    for (const block of message.content) {
      if (block.type === 'text' && block.text.length > 0) pieces.push(block.text)
      if (block.type === 'tool-call') pieces.push(`<tool_call name="${block.name}">${block.arguments || '{}'}</tool_call>`)
    }
    return pieces.length > 0 ? `<assistant>\n${pieces.join('\n')}\n</assistant>` : undefined
  }
  if (message.role === 'tool') {
    const body = clipMiddle(textOf(message.content), TOOL_RESULT_BUDGET_BYTES)
    return `<tool_result id="${message.toolCallId}"${message.isError === true ? ' error="true"' : ''}>\n${body}\n</tool_result>`
  }
  return undefined
}

/**
 * The conversation for the user message, newest turns first within the budget. The latest turn is
 * always kept (clipped if it alone is too big); older turns that do not fit are summarised as a count.
 */
export function buildConversation(messages: GenerateOptions['messages'], budgetBytes = CONVERSATION_BUDGET_BYTES): string {
  const rendered = messages.map(renderMessage).filter((m): m is string => m !== undefined)
  const kept: string[] = []
  let used = 0
  for (let i = rendered.length - 1; i >= 0; i--) {
    const piece = rendered[i]!
    const size = Buffer.byteLength(piece) + 2
    if (kept.length === 0 && size > budgetBytes) {
      kept.unshift(clipMiddle(piece, budgetBytes - 200))
      used = budgetBytes
      continue
    }
    if (used + size > budgetBytes) break
    kept.unshift(piece)
    used += size
  }
  const omitted = rendered.length - kept.length
  const head = omitted > 0 ? [`[${omitted} earlier turn(s) omitted to fit the request size; the latest turns follow.]`] : []
  return [...head, ...kept].join('\n\n')
}

/**
 * Streaming filter: passes answer text through and hides everything from the first `<tool_call`
 * onward, holding back a trailing fragment that could be the start of that tag.
 */
export class ToolCallFilter {
  private pending = ''
  private hidden = false

  feed(delta: string): string {
    if (this.hidden) return ''
    this.pending += delta
    const at = this.pending.indexOf(OPEN_TAG)
    if (at >= 0) {
      const visible = this.pending.slice(0, at)
      this.pending = ''
      this.hidden = true
      return visible
    }
    const lt = this.pending.lastIndexOf('<')
    if (lt >= 0 && OPEN_TAG.startsWith(this.pending.slice(lt))) {
      const visible = this.pending.slice(0, lt)
      this.pending = this.pending.slice(lt)
      return visible
    }
    const visible = this.pending
    this.pending = ''
    return visible
  }

  end(): string {
    if (this.hidden) return ''
    const rest = this.pending
    this.pending = ''
    return rest
  }
}

export interface ParsedAnswer {
  text: string
  calls: { name: string, arguments: string }[]
  /** Tool blocks that named an unknown tool or carried invalid JSON. */
  rejected: string[]
}

function stripFence(body: string): string {
  const trimmed = body.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed)
  return fenced ? fenced[1]! : trimmed
}

/** Split a finished answer into visible text and validated tool calls. */
export function parseAnswer(response: string, toolNames: ReadonlySet<string>): ParsedAnswer {
  const calls: ParsedAnswer['calls'] = []
  const rejected: string[] = []
  const first = response.indexOf(OPEN_TAG)
  const text = (first >= 0 ? response.slice(0, first) : response).trim()
  const pattern = /<tool_call\s+name="([^"]+)"\s*>([\s\S]*?)<\/tool_call>/g
  for (const match of response.matchAll(pattern)) {
    const name = match[1]!
    if (!toolNames.has(name)) { rejected.push(`unknown tool "${name}"`); continue }
    try {
      const parsed = JSON.parse(stripFence(match[2] ?? '') || '{}') as unknown
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object')
      calls.push({ name, arguments: JSON.stringify(parsed) })
    } catch {
      rejected.push(`invalid arguments for "${name}"`)
    }
  }
  return { text, calls, rejected }
}

export function usageOf(usage: AgyUsage | undefined): TokenUsage | undefined {
  if (usage === undefined) return undefined
  return {
    inputTokens: Math.max(0, (usage.input_tokens ?? 0) - (usage.cache_read_tokens ?? 0)),
    outputTokens: usage.output_tokens ?? 0,
    ...usage.thinking_tokens ? { reasoningTokens: usage.thinking_tokens } : {},
    ...usage.cache_read_tokens ? { cacheReadTokens: usage.cache_read_tokens } : {},
  }
}
