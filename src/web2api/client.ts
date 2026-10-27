import { fetch as undiciFetch } from 'undici'
import type {
  OpenAiChatChunk,
  OpenAiChatPayload,
  Web2ApiSettings,
} from './types.ts'

export type Web2ApiEvent =
  | { type: 'text', text: string }
  | { type: 'thought', text: string }
  | { type: 'tool_call', index: number, id?: string, name?: string, arguments?: string }
  | { type: 'usage', promptTokens: number, completionTokens: number, totalTokens: number }
  | { type: 'finish', reason: string }

export class Web2ApiClient {
  constructor(private readonly getSettings: () => Promise<Web2ApiSettings>) {}

  async *streamChat(
    payload: OpenAiChatPayload,
    signal?: AbortSignal,
  ): AsyncIterable<Web2ApiEvent> {
    const settings = await this.getSettings()
    const endpoint = settings.baseUrl.endsWith('/v1')
      ? `${settings.baseUrl}/chat/completions`
      : `${settings.baseUrl}/v1/chat/completions`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    }
    if (settings.apiKey) {
      headers.Authorization = `Bearer ${settings.apiKey}`
    }

    const response = await undiciFetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload, stream: true }),
      signal,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`Web2API error (HTTP ${response.status}): ${errText || response.statusText}`)
    }

    if (!response.body) {
      throw new Error('Web2API returned empty response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    let inThoughtTag = false

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line || line.startsWith(':')) continue
          if (line === 'data: [DONE]') {
            yield { type: 'finish', reason: 'stop' }
            return
          }
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim()
            try {
              const chunk = JSON.parse(dataStr) as OpenAiChatChunk
              if (chunk.usage) {
                yield {
                  type: 'usage',
                  promptTokens: chunk.usage.prompt_tokens,
                  completionTokens: chunk.usage.completion_tokens,
                  totalTokens: chunk.usage.total_tokens,
                }
              }

              const choice = chunk.choices?.[0]
              if (!choice) continue

              const delta = choice.delta
              if (delta) {
                // 1. Check reasoning / thought delta
                const thoughtText = delta.reasoning_content ?? delta.thought
                if (typeof thoughtText === 'string' && thoughtText.length > 0) {
                  yield { type: 'thought', text: thoughtText }
                }

                // 2. Check regular content delta with <thought> inline parsing support
                if (typeof delta.content === 'string' && delta.content.length > 0) {
                  let text = delta.content
                  while (text.length > 0) {
                    if (!inThoughtTag) {
                      const tagStart = text.indexOf('<thought>')
                      if (tagStart !== -1) {
                        const before = text.slice(0, tagStart)
                        if (before.length > 0) yield { type: 'text', text: before }
                        inThoughtTag = true
                        text = text.slice(tagStart + 9)
                      } else {
                        yield { type: 'text', text }
                        break
                      }
                    } else {
                      const tagEnd = text.indexOf('</thought>')
                      if (tagEnd !== -1) {
                        const thoughtContent = text.slice(0, tagEnd)
                        if (thoughtContent.length > 0) yield { type: 'thought', text: thoughtContent }
                        inThoughtTag = false
                        text = text.slice(tagEnd + 10)
                      } else {
                        yield { type: 'thought', text }
                        break
                      }
                    }
                  }
                }

                // 3. Check tool calls
                if (Array.isArray(delta.tool_calls)) {
                  for (const tc of delta.tool_calls) {
                    yield {
                      type: 'tool_call',
                      index: tc.index,
                      id: tc.id,
                      name: tc.function?.name,
                      arguments: tc.function?.arguments,
                    }
                  }
                }
              }

              if (choice.finish_reason) {
                yield { type: 'finish', reason: choice.finish_reason }
              }
            } catch {
              // Ignore non-JSON SSE data
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async generateImage(prompt: string, signal?: AbortSignal): Promise<string> {
    const settings = await this.getSettings()
    const endpoint = settings.baseUrl.endsWith('/v1')
      ? `${settings.baseUrl}/images/generations`
      : `${settings.baseUrl}/v1/images/generations`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
    if (settings.apiKey) {
      headers.Authorization = `Bearer ${settings.apiKey}`
    }

    const response = await undiciFetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt,
        model: 'imagen-3',
        n: 1,
        size: '1024x1024',
      }),
      signal,
    })

    if (!response.ok) {
      const err = await response.text().catch(() => '')
      throw new Error(`Image generation failed (${response.status}): ${err}`)
    }

    const data = await response.json() as { data?: { url?: string, b64_json?: string }[] }
    const first = data?.data?.[0]
    if (first?.url) return first.url
    if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`
    throw new Error('No image returned in response')
  }
}
