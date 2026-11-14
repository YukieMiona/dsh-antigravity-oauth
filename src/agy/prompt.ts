import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm'
import { isDroppedToolName } from '../native-tools.ts'
import type { AgyUsage } from './run.ts'

/**
 * agy is an agent CLI, not a raw model endpoint. The whole DSH request is rendered as one
 * transcript, and a JSON schema makes the model answer either with text or with tool calls that
 * DSH executes. agy's own tools are denied by policy (see run.ts).
 */

type Tool = NonNullable<GenerateOptions['tools']>[number]

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

function toolsOf(options: Pick<GenerateOptions, 'tools' | 'purpose'>): Tool[] {
  if (options.purpose === 'compaction' || options.purpose === 'session-title') return []
  return (options.tools ?? []).filter(tool => !isDroppedToolName(tool.name))
}

export function buildAgyPrompt(options: Pick<GenerateOptions, 'messages' | 'system' | 'tools' | 'purpose'>): { prompt: string, tools: Tool[] } {
  const tools = toolsOf(options)
  const out: string[] = [
    'You are the language model behind the DSH agent harness. The harness runs all tools; you never run tools yourself and must not call any of your own tools.',
    'Below are the harness system instructions, the tools it offers, and the conversation. Write the next assistant turn.',
  ]
  const system = [options.system ?? '', ...options.messages.filter(m => m.role === 'system').map(m => textOf(m.content))]
    .map(text => text.trim()).filter(text => text.length > 0).join('\n\n')
  if (system.length > 0) out.push(`<system>\n${system}\n</system>`)
  if (tools.length > 0) {
    out.push('<tools>')
    for (const tool of tools) {
      out.push(`- ${tool.name}: ${tool.description}\n  parameters (JSON schema): ${JSON.stringify(tool.parameters)}`)
    }
    out.push('</tools>')
  }
  out.push('<conversation>')
  for (const message of options.messages) {
    if (message.role === 'user') {
      out.push(`<user>\n${textOf(message.content)}\n</user>`)
    } else if (message.role === 'assistant') {
      const pieces: string[] = []
      for (const block of message.content) {
        if (block.type === 'text' && block.text.length > 0) pieces.push(block.text)
        if (block.type === 'tool-call') pieces.push(`<tool_call id="${block.id}" name="${block.name}">${block.arguments || '{}'}</tool_call>`)
      }
      if (pieces.length > 0) out.push(`<assistant>\n${pieces.join('\n')}\n</assistant>`)
    } else if (message.role === 'tool') {
      out.push(`<tool_result id="${message.toolCallId}"${message.isError === true ? ' error="true"' : ''}>\n${textOf(message.content)}\n</tool_result>`)
    }
  }
  out.push('</conversation>')
  out.push(tools.length > 0
    ? 'Reply with kind "answer" and your reply in "text", or with kind "tool_calls" listing the tools the harness should run (each with "name" and an "arguments" object matching its schema). You may include short "text" with tool calls.'
    : 'Reply with your answer only.')
  return { prompt: out.join('\n\n'), tools }
}

export function agySchema(tools: readonly Tool[]): object | undefined {
  if (tools.length === 0) return undefined
  return {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['answer', 'tool_calls'] },
      text: { type: 'string' },
      tool_calls: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', enum: tools.map(tool => tool.name) },
            arguments: { type: 'object' },
          },
          required: ['name', 'arguments'],
        },
      },
    },
    required: ['kind'],
  }
}

function usageOf(usage: AgyUsage | undefined): TokenUsage | undefined {
  if (usage === undefined) return undefined
  return {
    inputTokens: Math.max(0, (usage.input_tokens ?? 0) - (usage.cache_read_tokens ?? 0)),
    outputTokens: usage.output_tokens ?? 0,
    ...usage.thinking_tokens ? { reasoningTokens: usage.thinking_tokens } : {},
    ...usage.cache_read_tokens ? { cacheReadTokens: usage.cache_read_tokens } : {},
  }
}

type Structured = { kind?: unknown, text?: unknown, tool_calls?: unknown }

/** Turn one finished agy result into a complete DSH chunk sequence. */
export function* agyResultChunks(
  result: { response: string, structured?: unknown, usage?: AgyUsage },
  model: string,
  newId: () => string,
): Generator<StreamChunk> {
  let index = 0
  const structured = (typeof result.structured === 'object' && result.structured !== null ? result.structured : undefined) as Structured | undefined
  const text = structured !== undefined
    ? (typeof structured.text === 'string' ? structured.text : '')
    : result.response.trim()
  const calls = Array.isArray(structured?.tool_calls) ? structured.tool_calls as { name?: unknown, arguments?: unknown }[] : []

  if (text.length > 0) {
    yield { type: 'block-start', index, blockType: 'text' }
    yield { type: 'text-delta', index, text }
    yield { type: 'block-end', index, block: { type: 'text', text } }
    index += 1
  }
  let emittedCalls = 0
  for (const call of calls) {
    if (typeof call?.name !== 'string' || call.name.length === 0) continue
    const id = ToolCallId(newId())
    const args = JSON.stringify(typeof call.arguments === 'object' && call.arguments !== null ? call.arguments : {})
    yield { type: 'block-start', index, blockType: 'tool-call' }
    yield { type: 'tool-call-delta', index, id, name: call.name, argumentsDelta: args }
    yield { type: 'block-end', index, block: { type: 'tool-call', id, name: call.name, arguments: args } }
    index += 1
    emittedCalls += 1
  }
  const usage = usageOf(result.usage)
  if (usage !== undefined) yield { type: 'usage', usage }
  if (emittedCalls > 0) {
    yield { type: 'finish', reason: { kind: 'tool-calls' } }
  } else if (index === 0) {
    yield { type: 'finish', reason: { kind: 'error', failure: { message: `model "${model}" returned an empty answer through agy`, code: 'EMPTY_RESPONSE' } } }
  } else {
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
