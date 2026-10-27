import { readFile } from 'node:fs/promises'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { fetch as undiciFetch } from 'undici'
import {
  DEFAULT_WEB2API_SETTINGS,
  type Web2ApiSettings,
  type Web2ApiTestResult,
} from './types.ts'

export function sanitizeWeb2ApiSettings(raw: unknown): Web2ApiSettings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_WEB2API_SETTINGS }
  const data = raw as Record<string, unknown>
  const enabled = Boolean(data.enabled)
  let baseUrl = typeof data.baseUrl === 'string' && data.baseUrl.trim().length > 0
    ? data.baseUrl.trim().replace(/\/+$/, '')
    : DEFAULT_WEB2API_SETTINGS.baseUrl
  const apiKey = typeof data.apiKey === 'string' ? data.apiKey.trim() : ''
  const models = Array.isArray(data.models)
    ? data.models.filter(m => typeof m === 'string' && m.trim().length > 0)
    : [...DEFAULT_WEB2API_SETTINGS.models]
  const enableImageTool = data.enableImageTool !== false
  const timeoutMs = typeof data.timeoutMs === 'number' && data.timeoutMs > 0
    ? data.timeoutMs
    : DEFAULT_WEB2API_SETTINGS.timeoutMs

  return {
    enabled,
    baseUrl,
    apiKey,
    models: models.length > 0 ? models : [...DEFAULT_WEB2API_SETTINGS.models],
    enableImageTool,
    timeoutMs,
  }
}

export class AntigravityWeb2ApiStore {
  constructor(readonly filename: string) {}

  async read(): Promise<Web2ApiSettings> {
    try {
      const text = await readFile(this.filename, 'utf-8')
      return sanitizeWeb2ApiSettings(JSON.parse(text))
    } catch {
      return { ...DEFAULT_WEB2API_SETTINGS }
    }
  }

  async save(settings: unknown): Promise<Web2ApiSettings> {
    const sanitized = sanitizeWeb2ApiSettings(settings)
    await writeFileAtomic(this.filename, JSON.stringify(sanitized, null, 2) + '\n', { mode: 0o600, dirMode: 0o700 })
    return sanitized
  }

  async testConnection(settings: Partial<Web2ApiSettings>): Promise<Web2ApiTestResult> {
    const target = sanitizeWeb2ApiSettings(settings)
    const start = Date.now()
    try {
      const endpoint = target.baseUrl.endsWith('/v1')
        ? `${target.baseUrl}/models`
        : `${target.baseUrl}/v1/models`

      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      if (target.apiKey) {
        headers.Authorization = `Bearer ${target.apiKey}`
      }

      const res = await undiciFetch(endpoint, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10_000),
      })

      const latencyMs = Date.now() - start
      if (!res.ok) {
        return {
          ok: false,
          latencyMs,
          error: `HTTP ${res.status}: ${res.statusText}`,
        }
      }

      const body = await res.json() as { data?: { id?: string }[] }
      const modelIds = Array.isArray(body?.data)
        ? body.data.map(m => m.id).filter((id): id is string => typeof id === 'string')
        : undefined

      return {
        ok: true,
        latencyMs,
        models: modelIds,
      }
    } catch (err: unknown) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
