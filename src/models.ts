import type { ChatWireModelId, PublicModelId, ReasoningEffort } from './types.ts'

export interface ModelCatalogItem {
  id: string
  name: string
  contextWindow: number
  maxTokens: number
  description?: string
  supportsImages?: boolean
  supportsThinking?: boolean
  thinkingBudget?: number
}

export const DEFAULT_CATALOG_MODELS: readonly ModelCatalogItem[] = [
  { id: 'gemini-4-argon', name: 'Gemini 4 Argon', contextWindow: 1_048_576, maxTokens: 65_536, supportsImages: true, supportsThinking: true },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', contextWindow: 1_048_576, maxTokens: 65_536, supportsImages: true, supportsThinking: true },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', contextWindow: 1_048_576, maxTokens: 65_536, supportsImages: true, supportsThinking: true },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', contextWindow: 1_048_576, maxTokens: 65_536, supportsImages: true },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)', contextWindow: 250_000, maxTokens: 64_000, supportsImages: true, supportsThinking: true },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)', contextWindow: 250_000, maxTokens: 64_000, supportsImages: true, supportsThinking: true },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1_048_576, maxTokens: 65_535, supportsImages: true, supportsThinking: true },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)', contextWindow: 131_072, maxTokens: 32_768, supportsThinking: true },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', contextWindow: 1_048_576, maxTokens: 65_535, supportsImages: true },
]

export const PUBLIC_MODELS = [
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  },
] as const satisfies readonly {
  id: PublicModelId
  name: string
  contextWindow: number
  maxTokens: number
}[]

export const REASONING_EFFORTS = ['low', 'medium', 'high'] as const satisfies readonly ReasoningEffort[]

export const DEFAULT_REASONING_EFFORT: ReasoningEffort = 'medium'

export const DEFAULT_ENABLED_MODELS: readonly PublicModelId[] = ['gemini-3.8-flash']

const ARGON_4: Record<ReasoningEffort, ChatWireModelId> = {
  low: 'gemini-4-argon-low',
  medium: 'gemini-4-argon-medium',
  high: 'gemini-4-argon-high',
}

const FLASH_38: Record<ReasoningEffort, ChatWireModelId> = {
  low: 'gemini-3.8-flash-low',
  medium: 'gemini-3.8-flash-medium',
  high: 'gemini-3.8-flash-high',
}

const FLASH_37: Record<ReasoningEffort, ChatWireModelId> = {
  low: 'gemini-3.7-flash-low',
  medium: 'gemini-3.7-flash-medium',
  high: 'gemini-3.7-flash-high',
}

const FLASH_35: Record<ReasoningEffort, ChatWireModelId> = {
  low: 'gemini-3.5-flash-extra-low',
  medium: 'gemini-3.5-flash-low',
  high: 'gemini-3-flash-agent',
}

const WIRE: Record<string, Record<ReasoningEffort, ChatWireModelId>> = {
  'gemini-4-argon': ARGON_4,
  'gemini-3.8-flash': FLASH_38,
  'gemini-3.7-flash': FLASH_37,
  'gemini-3.5-flash': FLASH_35,
}

const THINKING_LEVEL: Record<ReasoningEffort, 'LOW' | 'MEDIUM' | 'HIGH'> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
}

export function isPublicModelId(id: string): id is PublicModelId {
  return typeof id === 'string' && id.trim().length > 0
}

export function isReasoningEffort(value: string): value is ReasoningEffort {
  return value === 'low' || value === 'medium' || value === 'high'
}

export function routeChatModel(model: PublicModelId, effort: ReasoningEffort = DEFAULT_REASONING_EFFORT): ChatWireModelId {
  if (WIRE[model]) return WIRE[model][effort]
  return model
}

export function thinkingLevelFor(model: PublicModelId, effort: ReasoningEffort): 'LOW' | 'MEDIUM' | 'HIGH' | undefined {
  if (model.startsWith('claude-') || model.startsWith('gpt-')) return undefined
  if (model === 'gemini-3.5-flash' || model.includes('lite')) return undefined
  return THINKING_LEVEL[effort]
}

export function publicModel(id: string): ModelCatalogItem | undefined {
  return DEFAULT_CATALOG_MODELS.find(model => model.id === id) ?? PUBLIC_MODELS.find(model => model.id === id)
}
