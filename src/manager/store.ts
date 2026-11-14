import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { DEFAULT_MANAGER_BASE_URL } from '../ids.ts'

/**
 * Route model requests through a local OpenAI-compatible gateway (Antigravity Manager) instead of
 * calling Cloud Code Assist directly. The gateway owns its own account pool and failover.
 */
/** How the main provider reaches Google: the plugin itself, a local gateway, or the official agy CLI. */
export type RouteKind = 'direct' | 'gateway' | 'agy'
export const ROUTE_KINDS: readonly RouteKind[] = ['direct', 'gateway', 'agy']

export interface ManagerSettings {
  route: RouteKind
  /** Legacy mirror of `route === 'gateway'`, kept so older settings files and callers still work. */
  enabled: boolean
  /** OpenAI-style base URL ending in `/v1`. */
  baseUrl: string
  apiKey: string
  /** Path of the official Antigravity CLI binary used by the `agy` route. */
  agyPath: string
}

/** What the settings UI may see: the key itself never leaves the server. */
export interface ManagerSettingsView {
  route: RouteKind
  enabled: boolean
  agyPath: string
  baseUrl: string
  hasApiKey: boolean
  apiKeyHint: string
}

export const DEFAULT_AGY_PATH = join(homedir(), '.local', 'bin', 'agy')

export const DEFAULT_MANAGER_SETTINGS: ManagerSettings = {
  route: 'direct',
  enabled: false,
  baseUrl: DEFAULT_MANAGER_BASE_URL,
  apiKey: '',
  agyPath: DEFAULT_AGY_PATH,
}

function isRouteKind(value: unknown): value is RouteKind {
  return typeof value === 'string' && (ROUTE_KINDS as readonly string[]).includes(value)
}

function normalizeAgyPath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) return DEFAULT_AGY_PATH
  const path = raw.trim()
  if (!isAbsolute(path)) throw new Error('agy path must be absolute')
  return path
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
  // Files written before routes existed only have `enabled`, which meant the gateway.
  const route: RouteKind = isRouteKind(data.route) ? data.route : data.enabled === true ? 'gateway' : 'direct'
  let agyPath = DEFAULT_AGY_PATH
  try { agyPath = normalizeAgyPath(data.agyPath) } catch { /* keep default for a hand-edited bad value */ }
  return {
    route,
    enabled: route === 'gateway',
    baseUrl,
    apiKey: typeof data.apiKey === 'string' ? data.apiKey.trim() : '',
    agyPath,
  }
}

export function viewOf(settings: ManagerSettings): ManagerSettingsView {
  return {
    route: settings.route,
    enabled: settings.enabled,
    agyPath: settings.agyPath,
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
    // `route` wins; a bare `enabled` (older UI or callers) toggles between direct and gateway.
    const route: RouteKind = isRouteKind(data.route)
      ? data.route
      : typeof data.enabled === 'boolean' ? (data.enabled ? 'gateway' : 'direct') : current.route
    const next: ManagerSettings = {
      route,
      enabled: route === 'gateway',
      baseUrl: data.baseUrl === undefined ? current.baseUrl : normalizeBaseUrl(data.baseUrl),
      apiKey: typeof data.apiKey === 'string' ? data.apiKey.trim() : current.apiKey,
      agyPath: data.agyPath === undefined ? current.agyPath : normalizeAgyPath(data.agyPath),
    }
    await writeFileAtomic(this.filename, JSON.stringify(next, null, 2) + '\n', { mode: 0o600, dirMode: 0o700 })
    this.cached = { settings: next, at: Date.now() }
    return next
  }
}
