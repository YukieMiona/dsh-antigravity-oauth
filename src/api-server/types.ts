import { DEFAULT_API_SERVER_HOST, DEFAULT_API_SERVER_PORT } from '../ids.ts'

export interface ApiServerSettings {
  enabled: boolean
  host: string
  port: number
  apiKey: string
}

export interface ApiServerStatus {
  running: boolean
  host: string
  port: number
  error?: string
}

export const DEFAULT_API_SERVER_SETTINGS: ApiServerSettings = {
  enabled: false,
  host: DEFAULT_API_SERVER_HOST,
  port: DEFAULT_API_SERVER_PORT,
  apiKey: '',
}

export interface OpenAiModelItem {
  id: string
  object: 'model'
  created: number
  owned_by: string
}

export interface OpenAiModelsResponse {
  object: 'list'
  data: OpenAiModelItem[]
}
