import { dirname, join } from 'node:path'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import { AGY_WORKSPACE_DIRNAME } from '../ids.ts'
import { buildTemplateBody, CONVERSATION_BUDGET_BYTES, parseAnswer, splitConversation, TEMPLATE_BUDGET_BYTES, ToolCallFilter } from './prompt.ts'
import { streamAgy, type AgyResult, type AgyUsage } from './run.ts'
import { ensureTemplate } from './template.ts'

export type AgyTurnEvent =
  | { type: 'text', text: string }
  | { type: 'done', text: string, calls: { name: string, arguments: string }[], rejected: string[], usage?: AgyUsage }

export interface AgyTurnOptions {
  binary: string
  workspace: string
  /** Base model id; effort is separate. */
  model: string
  effort?: 'low' | 'medium' | 'high'
  request: Pick<GenerateOptions, 'messages' | 'system' | 'tools' | 'purpose'>
  signal?: AbortSignal
  onActivity?: () => void
}

/**
 * Context window DSH should plan for on this route. One request carries about 620 KB (100 KB in
 * the user message plus a 520 KB template), so DSH has to compact before the model's own limit.
 */
export const AGY_CONTEXT_WINDOW_TOKENS = 131_072

/** Plugin-owned directory next to the auth file; agy runs in it and reads agent templates from it. */
export function agyWorkspace(authFilename: string): string {
  return join(dirname(authFilename), AGY_WORKSPACE_DIRNAME)
}

/**
 * One model turn through the official CLI, shared by the DSH adapter and the local API server:
 * visible text as it streams, then one `done` event with the validated tool calls and usage.
 */
export async function* agyTurn(options: AgyTurnOptions): AsyncGenerator<AgyTurnEvent> {
  const { body, tools } = buildTemplateBody(options.request)
  const conversation = splitConversation(
    options.request.messages,
    CONVERSATION_BUDGET_BYTES,
    Math.max(0, TEMPLATE_BUDGET_BYTES - Buffer.byteLength(body)),
  )
  const agent = await ensureTemplate(options.workspace, conversation.earlier.length === 0
    ? body
    : `${body}\n\n# Earlier conversation (oldest first)\n\n${conversation.earlier}\n\n(End of the earlier conversation. The latest turns arrive in the user message.)`)
  const filter = new ToolCallFilter()
  let streamed = ''
  let result: AgyResult | undefined
  for await (const event of streamAgy({
    binary: options.binary,
    cwd: options.workspace,
    model: options.model,
    ...options.effort === undefined ? {} : { effort: options.effort },
    agent,
    prompt: conversation.recent,
    ...options.signal === undefined ? {} : { signal: options.signal },
    ...options.onActivity === undefined ? {} : { onActivity: options.onActivity },
  })) {
    if (event.type === 'result') { result = event.result; break }
    const visible = filter.feed(event.text)
    if (visible.length === 0) continue
    streamed += visible
    yield { type: 'text', text: visible }
  }
  const tail = filter.end()
  if (tail.length > 0) {
    streamed += tail
    yield { type: 'text', text: tail }
  }
  const parsed = parseAnswer(result?.response ?? streamed, new Set(tools.map(tool => tool.name)))
  // A result that arrived without streamed deltas still carries the full answer.
  if (streamed.length === 0 && parsed.text.length > 0) {
    streamed = parsed.text
    yield { type: 'text', text: parsed.text }
  }
  yield {
    type: 'done',
    text: streamed.trimEnd(),
    calls: parsed.calls,
    rejected: parsed.rejected,
    ...result?.usage === undefined ? {} : { usage: result.usage },
  }
}
