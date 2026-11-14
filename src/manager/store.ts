import { readFile } from 'node:fs/promises'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { DEFAULT_MANAGER_BASE_URL } from '../ids.ts'

/**
 * Route model requests through a local OpenAI-compatible gateway (Antigravity Manager) instead of
 * calling Cloud Code Assist directly. The gateway owns its own account pool and failover.
 */
export interface ManagerSettings {
  enabled: boolean
  /** OpenAI-style base URL ending in `/v1`. */
  baseUrl: string
  apiKey: string
}

/** What the settings UI may see: the key itself never leaves the server. */
export interface ManagerSettingsView {
  enabled: boolean
  baseUrl: string
  hasApiKey: boolean
  apiKeyHint: string
}

export const DEFAULT_MANAGER_SETTINGS: ManagerSettings = {
  enabled: false,
  baseUrl: DEFAULT_MANAGER_BASE_URL,
  apiKey: '',
}

/** Accepts `http(s)://host[:port][/path]` without credentials, query, or fragment; strips trailing slashes. */
export function normalizeBaseUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) return DEFAULT_MANAGER_BASE_URL
  const parsed = new URL(raw.trim())
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Gateway URL must use http or https')
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Gateway URL must not contain credentials, a query, or a fragment')
  }
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '')
}

export function chatCompletionsUrl(baseUrl: string): string {
  return baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`
}

export function modelsUrl(baseUrl: string): string {
  return baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`
}

/** The gateway's unauthenticated liveness endpoint sits at the origin, not under `/v1`. */
export function healthUrl(baseUrl: string): string {
  return `${new URL(baseUrl).origin}/health`
}

function parseStored(raw: unknown): ManagerSettings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_MANAGER_SETTINGS }
  const data = raw as Record<string, unknown>
  let baseUrl = DEFAULT_MANAGER_BASE_URL
  try { baseUrl = normalizeBaseUrl(data.baseUrl) } catch { /* keep default for a hand-edited bad value */ }
  return {
    enabled: data.enabled === true,
    baseUrl,
    apiKey: typeof data.apiKey === 'string' ? data.apiKey.trim() : '',
  }
}

export function viewOf(settings: ManagerSettings): ManagerSettingsView {
  return {
    enabled: settings.enabled,
    baseUrl: settings.baseUrl,
    hasApiKey: settings.apiKey.length > 0,
    apiKeyHint: settings.apiKey.length >= 8 ? `…${settings.apiKey.slice(-4)}` : '',
  }
}

export class AntigravityManagerStore {
  private cached?: { settings: ManagerSettings, at: number }

  constructor(readonly filename: string) {}

  /**
   * The adapter reads this on every request, so a short cache avoids a disk read per turn.
   * `save()` refreshes it, so a toggle in the UI takes effect immediately.
   */
  async read(): Promise<ManagerSettings> {
    if (this.cached !== undefined && Date.now() - this.cached.at < 2_000) return this.cached.settings
    let settings: ManagerSettings
    try {
      settings = parseStored(JSON.parse(await readFile(this.filename, 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[dsh-antigravity-oauth] unreadable bridge settings, using defaults:', (error as Error).message)
      }
      settings = { ...DEFAULT_MANAGER_SETTINGS }
    }
    this.cached = { settings, at: Date.now() }
    return settings
  }

  /**
   * Merge a UI patch. `apiKey` omitted keeps the stored key; an empty string clears it.
   * Throws on an invalid URL so the UI can show the reason.
   */
  async save(patch: unknown): Promise<ManagerSettings> {
    if (typeof patch !== 'object' || patch === null) throw new Error('expected a JSON object')
    const data = patch as Record<string, unknown>
    const current = await this.read()
    const next: ManagerSettings = {
      enabled: typeof data.enabled === 'boolean' ? data.enabled : current.enabled,
      baseUrl: data.baseUrl === undefined ? current.baseUrl : normalizeBaseUrl(data.baseUrl),
      apiKey: typeof data.apiKey === 'string' ? data.apiKey.trim() : current.apiKey,
    }
    await writeFileAtomic(this.filename, JSON.stringify(next, null, 2) + '\n', { mode: 0o600, dirMode: 0o700 })
    this.cached = { settings: next, at: Date.now() }
    return next
  }
}
