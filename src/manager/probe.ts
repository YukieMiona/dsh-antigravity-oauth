import { DEFAULT_NATIVE_CORE_URL } from '../ids.ts'
import { healthUrl, modelsUrl } from './store.ts'

export interface BridgeProbeResult {
  /** The gateway answered `/models` with the given key. */
  ok: boolean
  latencyMs: number
  models: string[]
  error?: string
  /** Gateway process answers its unauthenticated health check. */
  gatewayUp: boolean
  /** Native language_server answers on its local port (any status counts). */
  coreUp: boolean
}

type FetchLike = typeof fetch

const PROBE_TIMEOUT_MS = 4_000

async function reachable(url: string, fetchImpl: FetchLike, init?: RequestInit): Promise<boolean> {
  try {
    const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    await res.body?.cancel().catch(() => undefined)
    return true
  } catch {
    return false
  }
}

async function listModels(
  baseUrl: string,
  apiKey: string,
  fetchImpl: FetchLike,
): Promise<Pick<BridgeProbeResult, 'ok' | 'latencyMs' | 'models' | 'error'>> {
  const start = Date.now()
  try {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (apiKey) headers.authorization = `Bearer ${apiKey}`
    const res = await fetchImpl(modelsUrl(baseUrl), { headers, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    const latencyMs = Date.now() - start
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined)
      const hint = res.status === 401 || res.status === 403 ? ' (check the API key)' : ''
      return { ok: false, latencyMs, models: [], error: `HTTP ${res.status}${hint}` }
    }
    const body = await res.json().catch(() => undefined) as { data?: { id?: unknown }[] } | undefined
    const models = Array.isArray(body?.data)
      ? body.data.map(m => m?.id).filter((id): id is string => typeof id === 'string')
      : []
    return { ok: true, latencyMs, models }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, latencyMs: Date.now() - start, models: [], error: message }
  }
}

export async function probeBridge(
  target: { baseUrl: string, apiKey: string },
  options: { fetchImpl?: FetchLike, coreUrl?: string } = {},
): Promise<BridgeProbeResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const [models, gatewayUp, coreUp] = await Promise.all([
    listModels(target.baseUrl, target.apiKey, fetchImpl),
    reachable(healthUrl(target.baseUrl), fetchImpl),
    reachable(options.coreUrl ?? DEFAULT_NATIVE_CORE_URL, fetchImpl),
  ])
  return { ...models, gatewayUp: gatewayUp || models.ok, coreUp }
}
