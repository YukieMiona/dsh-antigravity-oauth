import { LlmAdapter, LlmError, ReasoningEffortId, ToolCallId } from '@deepseek-ai/dsh-llm'
import type {
  ContentBlock,
  GenerateOptions,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  Message,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { resolveImageBlock } from '../image-input.ts'
import { Web2ApiClient } from './client.ts'
import {
  DEFAULT_WEB2API_MODELS,
  type OpenAiChatPayload,
  type OpenAiContentPart,
  type OpenAiMessage,
  type Web2ApiSettings,
} from './types.ts'

export const WEB2API_ROUTE = 'agy-web'
const IMAGE_ONLY_PROMPT = 'See the attached image.'

function textOf(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

async function userContentOf(
  blocks: readonly ContentBlock[],
  attachments?: AttachmentStore,
  signal?: AbortSignal,
): Promise<string | OpenAiContentPart[]> {
  const parts: OpenAiContentPart[] = []
  for (const block of blocks) {
    if (block.type === 'text') {
      if (block.text.length > 0) parts.push({ type: 'text', text: block.text })
      continue
    }
    if (block.type === 'image') {
      const image = await resolveImageBlock(block, attachments, signal)
      parts.push(image.type === 'inline'
        ? { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }
        : { type: 'text', text: image.text })
    }
  }
  const textParts = parts.filter(part => part.type === 'text')
  if (textParts.length === parts.length) return textParts.map(part => part.text).join('')
  // The gateway takes the latest question from text alone, so an image-only message would
  // otherwise be paired with the previous question.
  if (textParts.length === 0) parts.unshift({ type: 'text', text: IMAGE_ONLY_PROMPT })
  return parts
}

export async function convertMessagesToOpenAi(
  messages: readonly { role: string, content: readonly ContentBlock[] }[],
  systemPrompt?: string,
  attachments?: AttachmentStore,
  signal?: AbortSignal,
): Promise<OpenAiMessage[]> {
  const result: OpenAiMessage[] = []
  if (systemPrompt && systemPrompt.trim().length > 0) {
    result.push({ role: 'system', content: systemPrompt.trim() })
  }

  // The gateway uploads every image it receives on each request, and one it rejects would fail
  // every later turn. Only the newest user message carries image bytes.
  const newestUser = messages.map(message => message.role).lastIndexOf('user')
  for (const [index, message] of messages.entries()) {
    if (message.role === 'user') {
      const store = index === newestUser ? attachments : undefined
      result.push({ role: 'user', content: await userContentOf(message.content, store, signal) })
    } else if (message.role === 'assistant') {
      const text = textOf(message.content)
      result.push({ role: 'assistant', content: text })
    }
  }

  return result
}

export class Web2ApiAdapter extends LlmAdapter {
  private readonly client: Web2ApiClient

  constructor(
    private readonly getSettings: () => Promise<Web2ApiSettings>,
    private readonly resolveAttachments?: () => AttachmentStore | undefined,
  ) {
    super()
    this.client = new Web2ApiClient(getSettings)
  }

  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: 'Gemini Web (Web2API)' }
  }

  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const settings = await this.getSettings()
    return settings.models.map(id => {
      const predefined = DEFAULT_WEB2API_MODELS.find(m => m.id === id)
      return {
        provider,
        id,
        name: predefined?.name ?? `${id} (Web)`,
        inputModalities: ['text', 'image'] as const,
      }
    })
  }

  override async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const predefined = DEFAULT_WEB2API_MODELS.find(m => m.id === model)
    const contextWindow = predefined?.contextWindow ?? 1_048_576
    const maxTokens = predefined?.maxTokens ?? 65_536

    return {
      provider,
      id: model,
      name: predefined?.name ?? `${model} (Web)`,
      inputModalities: ['text', 'image'],
      context: { contextWindow },
      defaultMaxTokens: maxTokens,
      reasoning: {
        efforts: [
          { id: ReasoningEffortId('low'), name: 'Low' },
          { id: ReasoningEffortId('medium'), name: 'Medium' },
          { id: ReasoningEffortId('high'), name: 'High' },
        ],
        defaultEffort: ReasoningEffortId('medium'),
      },
    }
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const settings = await this.getSettings()
    if (!settings.enabled) {
      throw new LlmError('Gemini Web2API is disabled. Enable it in Settings → Antigravity.', 'NO_ADAPTER')
    }

    const payload: OpenAiChatPayload = {
      model: options.model,
      messages: await convertMessagesToOpenAi(
        options.messages,
        options.system,
        this.resolveAttachments?.(),
        options.signal,
      ),
      stream: true,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    }

    let currentIndex = 0
    let currentBlockType: 'text' | 'reasoning' | undefined
    let blockOpened = false

    const closeCurrentBlock = function* (): Generator<StreamChunk> {
      if (blockOpened) {
        currentIndex += 1
        blockOpened = false
        currentBlockType = undefined
      }
    }

    try {
      for await (const event of this.client.streamChat(payload, options.signal)) {
        if (event.type === 'thought') {
          if (currentBlockType !== 'reasoning') {
            yield* closeCurrentBlock()
            yield { type: 'block-start', index: currentIndex, blockType: 'reasoning' }
            currentBlockType = 'reasoning'
            blockOpened = true
          }
          yield { type: 'reasoning-delta', index: currentIndex, text: event.text }
        } else if (event.type === 'text') {
          if (currentBlockType !== 'text') {
            yield* closeCurrentBlock()
            yield { type: 'block-start', index: currentIndex, blockType: 'text' }
            currentBlockType = 'text'
            blockOpened = true
          }
          yield { type: 'text-delta', index: currentIndex, text: event.text }
        } else if (event.type === 'tool_call') {
          yield* closeCurrentBlock()
          const callId = ToolCallId(event.id ?? `call_${currentIndex}`)
          const toolName = event.name ?? 'unknown_tool'
          yield {
            type: 'block-start',
            index: currentIndex,
            blockType: 'tool-call',
          }
          if (event.arguments) {
            yield {
              type: 'tool-call-delta',
              index: currentIndex,
              id: callId,
              name: toolName,
              argumentsDelta: event.arguments,
            }
          }
          currentIndex += 1
        } else if (event.type === 'usage') {
          yield {
            type: 'usage',
            usage: {
              inputTokens: event.promptTokens,
              outputTokens: event.completionTokens,
            },
          }
        } else if (event.type === 'finish') {
          yield* closeCurrentBlock()
          yield { type: 'finish', reason: { kind: 'stop' } }
        }
      }
    } catch (err: unknown) {
      yield* closeCurrentBlock()
      const message = err instanceof Error ? err.message : String(err)
      throw new LlmError(`Web2API streaming error: ${message}`, 'UNKNOWN', { cause: err })
    }
  }
}
