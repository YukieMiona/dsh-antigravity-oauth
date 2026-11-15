import { DEFAULT_API_SERVER_HOST, DEFAULT_API_SERVER_PORT } from '../ids.ts'

export interface ApiServerSettings {
  enabled: boolean
  host: string
  port: number
  apiKey: string
  /** Most chat requests accepted in any 60 minutes; 0 = no limit. */
  hourlyLimit: number
  /** Most chat requests accepted in any 24 hours; 0 = no limit. */
  dailyLimit: number
}

export interface ApiServerStatus {
  running: boolean
  host: string
  port: number
  error?: string
  /** Chat requests accepted in the last 60 minutes and 24 hours (since the plugin started). */
  requestsLastHour?: number
  requestsLastDay?: number
}

export const DEFAULT_API_SERVER_SETTINGS: ApiServerSettings = {
  enabled: false,
  host: DEFAULT_API_SERVER_HOST,
  port: DEFAULT_API_SERVER_PORT,
  apiKey: '',
  hourlyLimit: 0,
  dailyLimit: 0,
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
