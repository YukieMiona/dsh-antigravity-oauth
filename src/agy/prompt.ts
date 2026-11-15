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
/** A template body is read whole up to at least 600 KB (1 MB fails), so older turns go there. */
export const TEMPLATE_BUDGET_BYTES = 520_000
/** One tool result may not crowd out the rest of the conversation. */
export const TOOL_RESULT_BUDGET_BYTES = 24_000

const OPEN_TAG = '<tool_call'

export type ImageBlock = Extract<ContentBlock, { type: 'image' }>
/** Text that stands for an image in the conversation: a staged file path, or a placeholder. */
export type ImageText = (block: ImageBlock) => string

export function imageName(block: ImageBlock): string {
  return block.attachment?.name || block.attachment?.attachmentId || 'image'
}

const noImage: ImageText = block => `[Image: ${imageName(block)} (not attached)]`

function textOf(blocks: readonly ContentBlock[], imageText: ImageText = noImage): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'text' && block.text.length > 0) parts.push(block.text)
    else if (block.type === 'image') parts.push(imageText(block))
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
export function buildTemplateBody(
  options: Pick<GenerateOptions, 'messages' | 'system' | 'tools' | 'purpose'>,
  withImages = false,
): { body: string, tools: Tool[] } {
  const tools = toolsOf(options)
  const system = [options.system ?? '', ...options.messages.filter(m => m.role === 'system').map(m => textOf(m.content))]
    .map(text => text.trim()).filter(text => text.length > 0).join('\n\n')
  const out: string[] = [
    'You are the language model behind the DSH agent harness. DSH owns the conversation and handles approvals.',
    tools.length > 0
      ? 'DSH\'s tools listed below are fully available to you: use them whenever the task needs them, by writing <tool_call> blocks as described at the end. Only this backend\'s own built-in tools are switched off; that never limits what DSH\'s tools can do.'
      : 'This request offers no tools; answer in text.',
    'The conversation arrives in the user message as tagged turns. Write the next assistant turn.',
  ]
  if (withImages) {
    out.push(
      '# Attached images',
      'An image in the conversation appears as a line `[Image file: /absolute/path]`. You cannot see it until you open it: '
        + 'before you answer, call the view_file tool once for every image file named at the end of the user message, with that exact absolute path, '
        + 'and describe only what you see. Never open any other path. Do not mention file paths or the act of opening files in your answer.',
    )
  }
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

function renderMessage(message: GenerateOptions['messages'][number], imageText?: ImageText): string | undefined {
  if (message.role === 'user') return `<user>\n${textOf(message.content, imageText)}\n</user>`
  if (message.role === 'assistant') {
    const pieces: string[] = []
    for (const block of message.content) {
      if (block.type === 'text' && block.text.length > 0) pieces.push(block.text)
      if (block.type === 'tool-call') pieces.push(`<tool_call name="${block.name}">${block.arguments || '{}'}</tool_call>`)
    }
    return pieces.length > 0 ? `<assistant>\n${pieces.join('\n')}\n</assistant>` : undefined
  }
  if (message.role === 'tool') {
    const body = clipMiddle(textOf(message.content, imageText), TOOL_RESULT_BUDGET_BYTES)
    return `<tool_result id="${message.toolCallId}"${message.isError === true ? ' error="true"' : ''}>\n${body}\n</tool_result>`
  }
  return undefined
}

export interface ConversationParts {
  /** Newest turns, for the user message. */
  recent: string
  /** Older turns that did not fit there, for the agent template; empty when everything fits. */
  earlier: string
}

/**
 * Split the conversation by size, newest first: the latest turns go into the user message, older
 * ones into the agent template (which agy reads whole), and only what fits neither is left out,
 * with a note saying how many turns that was. The latest turn is always kept, clipped if it alone
 * is too big.
 */
export function splitConversation(
  messages: GenerateOptions['messages'],
  recentBudget = CONVERSATION_BUDGET_BYTES,
  earlierBudget = 0,
  imageText?: ImageText,
): ConversationParts {
  const rendered = messages.map(message => renderMessage(message, imageText)).filter((m): m is string => m !== undefined)
  const recent: string[] = []
  const earlier: string[] = []
  let used = 0
  let i = rendered.length - 1
  for (; i >= 0; i--) {
    const piece = rendered[i]!
    const size = Buffer.byteLength(piece) + 2
    if (recent.length === 0 && size > recentBudget) {
      recent.unshift(clipMiddle(piece, recentBudget - 200))
      used = recentBudget
      continue
    }
    if (used + size > recentBudget) break
    recent.unshift(piece)
    used += size
  }
  let usedEarlier = 0
  for (; i >= 0; i--) {
    const piece = rendered[i]!
    const size = Buffer.byteLength(piece) + 2
    if (usedEarlier + size > earlierBudget) break
    earlier.unshift(piece)
    usedEarlier += size
  }
  const omitted = i + 1
  if (earlier.length === 0) {
    const head = omitted > 0 ? [`[${omitted} earlier turn(s) omitted to fit the request size; the latest turns follow.]`] : []
    return { recent: [...head, ...recent].join('\n\n'), earlier: '' }
  }
  const earlierHead = omitted > 0 ? [`[${omitted} oldest turn(s) omitted to fit the request size.]`] : []
  return {
    recent: ['[Earlier turns of this conversation are in your instructions under "Earlier conversation".]', ...recent].join('\n\n'),
    earlier: [...earlierHead, ...earlier].join('\n\n'),
  }
}

/** The conversation as one user message, without template overflow. */
export function buildConversation(messages: GenerateOptions['messages'], budgetBytes = CONVERSATION_BUDGET_BYTES): string {
  return splitConversation(messages, budgetBytes, 0).recent
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
