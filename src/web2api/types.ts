export interface Web2ApiModelConfig {
  id: string
  name: string
  contextWindow?: number
  maxTokens?: number
}

export interface Web2ApiSettings {
  enabled: boolean
  baseUrl: string
  apiKey?: string
  models: string[]
  enableImageTool: boolean
  timeoutMs?: number
}

export const DEFAULT_WEB2API_MODELS: readonly Web2ApiModelConfig[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Web)', contextWindow: 1_048_576, maxTokens: 65_536 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Web)', contextWindow: 1_048_576, maxTokens: 65_536 },
  { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking (Web)', contextWindow: 1_048_576, maxTokens: 65_536 },
  { id: 'imagen-3', name: 'Imagen 3 (Web Image Gen)', contextWindow: 8_192, maxTokens: 2_048 },
] as const

export const DEFAULT_WEB2API_SETTINGS: Web2ApiSettings = {
  enabled: false,
  baseUrl: 'http://127.0.0.1:8080/v1',
  apiKey: '',
  models: DEFAULT_WEB2API_MODELS.map(m => m.id),
  enableImageTool: true,
  timeoutMs: 120_000,
}

export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  tool_call_id?: string
}

export interface OpenAiChatPayload {
  model: string
  messages: OpenAiMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
  tools?: unknown[]
}

export interface OpenAiChatChunkChoice {
  index: number
  delta: {
    role?: string
    content?: string | null
    reasoning_content?: string | null
    thought?: string | null
    tool_calls?: {
      index: number
      id?: string
      type?: string
      function?: {
        name?: string
        arguments?: string
      }
    }[]
  }
  finish_reason?: string | null
}

export interface OpenAiChatChunk {
  id: string
  object: string
  created: number
  model: string
  choices: OpenAiChatChunkChoice[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface Web2ApiTestResult {
  ok: boolean
  latencyMs: number
  models?: string[]
  error?: string
}
