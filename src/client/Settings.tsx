import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AntigravityKey } from './locales.ts'
import type { AccountQuotaSummary, AccountSummary, AntigravityStatus } from '../types.ts'

const STATUS_PATH = '/plugins/dsh-antigravity-oauth/auth/status'
const LOGIN_PATH = '/plugins/dsh-antigravity-oauth/auth/login'
const COMPLETE_PATH = '/plugins/dsh-antigravity-oauth/auth/complete'
const LOGOUT_PATH = '/plugins/dsh-antigravity-oauth/auth/logout'
const SWITCH_PATH = '/plugins/dsh-antigravity-oauth/auth/accounts/switch'
const REMOVE_PATH = '/plugins/dsh-antigravity-oauth/auth/accounts/remove'
const QUOTAS_PATH = '/plugins/dsh-antigravity-oauth/auth/accounts/quotas'
const NETWORK_PATH = '/plugins/dsh-antigravity-oauth/network'
const WEB2API_SETTINGS_PATH = '/plugins/dsh-antigravity-oauth/web2api/settings'
const WEB2API_TEST_PATH = '/plugins/dsh-antigravity-oauth/web2api/test'

const STYLE_ID = 'dsh-antigravity-oauth-settings-theme'
const DOCKER_CMD = 'docker run -d --name gemini-web2api -p 18088:18088 zexadev/gemini-web2api-go:latest'

type Network = { mode: 'auto' | 'direct' | 'proxy', url: string, effective: string }
type ActiveTab = 'accounts' | 'web2api' | 'network'

export interface AntigravitySettingsInjected {
  t: (key: AntigravityKey, params?: Record<string, unknown>) => string
}

export type AntigravitySettingsProps = Partial<AntigravitySettingsInjected>

const SETTINGS_CSS = `
.dsh-agy-page { display:flex; flex-direction:column; gap:16px; width:100%; max-width:780px; color:#e0e0e0; font-family:inherit; }
.dsh-agy-header { display:flex; flex-direction:column; gap:4px; margin-bottom:2px; }
.dsh-agy-title { margin:0; font-size:20px; line-height:28px; font-weight:600; color:#ffffff; }
.dsh-agy-body { margin:0; font-size:13px; line-height:20px; color:#a0a0a0; }
.dsh-agy-error { margin:0; font-size:13px; line-height:20px; color:#f25a5a; }

/* Modern Segmented Navigation Tabs (Explicit High-Contrast Dark Colors) */
.dsh-agy-tabs-container {
  display:inline-flex; align-items:center; gap:4px; padding:4px;
  background:#1a1c1e !important;
  border:1px solid rgba(255,255,255,0.1) !important;
  border-radius:10px; width:fit-content; margin-bottom:6px;
}
.dsh-agy-tab-btn {
  display:inline-flex; align-items:center; gap:6px; padding:6px 16px;
  border:none !important; border-radius:8px !important;
  background:transparent !important;
  color:#9a9ea5 !important; font:inherit; font-size:13px; font-weight:500;
  cursor:pointer; transition:all 0.15s ease; user-select:none;
}
.dsh-agy-tab-btn:hover {
  color:#ffffff !important;
  background:rgba(255,255,255,0.06) !important;
}
.dsh-agy-tab-btn.is-active {
  color:#ffffff !important;
  background:#1677ff !important;
  box-shadow:0 2px 6px rgba(22, 119, 255, 0.4) !important;
  font-weight:600 !important;
}
.dsh-agy-tab-count {
  font-size:11px; padding:1px 6px; border-radius:10px;
  background:rgba(255,255,255,0.15); color:#ffffff;
}

/* Cards */
.dsh-agy-card {
  display:flex; flex-direction:column; gap:12px; padding:14px 16px;
  border:1px solid rgba(255,255,255,0.08);
  border-radius:12px; background:#1e2023;
}
.dsh-agy-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; }
.dsh-agy-card-title { margin:0; font-size:14px; font-weight:600; color:#ffffff; display:flex; align-items:center; gap:8px; }

/* Status Badges */
.dsh-agy-status-badge {
  display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border-radius:10px;
  font-size:11px; font-weight:500; background:rgba(255,255,255,0.08); color:#a0a0a0;
}
.dsh-agy-status-badge.is-success { background:rgba(34,160,107,0.2); color:#41c977; font-weight:600; }
.dsh-agy-status-badge.is-error { background:rgba(217,45,32,0.2); color:#f25a5a; }
.dsh-agy-status-badge.is-switching { background:rgba(250,140,22,0.2); color:#fa8c16; font-weight:600; }
.dsh-agy-dot { width:8px; height:8px; border-radius:50%; flex:0 0 auto; background:#6b7280; }
.dsh-agy-dot.is-signed-in, .dsh-agy-dot.is-active { background:#41c977; }
.dsh-agy-dot.is-error { background:#f25a5a; }
.dsh-agy-dot.is-signing-in { background:#1677ff; }

/* Buttons - Solid contrast colors that never wash out */
.dsh-agy-btn {
  box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center;
  min-height:30px; padding:4px 14px; border-radius:8px; font:inherit; font-size:13px; line-height:20px;
  cursor:pointer; transition:all 0.15s ease; text-decoration:none;
}
.dsh-agy-btn:disabled { opacity:0.45; cursor:not-allowed; }
.dsh-agy-btn-primary {
  background:#1677ff !important; color:#ffffff !important;
  border:1px solid #1677ff !important; box-shadow:0 1px 3px rgba(0,0,0,0.2); font-weight:500;
}
.dsh-agy-btn-primary:hover:not(:disabled) { background:#0958d9 !important; border-color:#0958d9 !important; }
.dsh-agy-btn-secondary {
  border:1px solid rgba(255,255,255,0.12) !important;
  background:#2b2d30 !important;
  color:#f0f0f0 !important;
}
.dsh-agy-btn-secondary:hover:not(:disabled) {
  background:#383b40 !important;
  border-color:#1677ff !important;
  color:#ffffff !important;
}
.dsh-agy-btn-compact { min-height:24px; padding:1px 8px; font-size:11px; border-radius:6px; }

/* Inputs */
.dsh-agy-input {
  box-sizing:border-box; width:100%; min-height:32px; padding:6px 10px; border-radius:8px;
  border:1px solid rgba(255,255,255,0.12);
  background:#141517; color:#f0f0f0;
  font:inherit; font-size:13px; outline:none; transition:border-color 0.15s ease;
}
.dsh-agy-input:focus { border-color:#1677ff; }
.dsh-agy-select {
  box-sizing:border-box; min-height:28px; padding:2px 8px; border-radius:6px;
  border:1px solid rgba(255,255,255,0.12);
  background:#141517; color:#f0f0f0;
  font:inherit; font-size:12px; cursor:pointer; outline:none;
}

/* Filter Chips */
.dsh-agy-chips { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.dsh-agy-chip {
  padding:3px 10px; border-radius:12px; font-size:11px; cursor:pointer;
  border:1px solid rgba(255,255,255,0.1);
  background:rgba(255,255,255,0.04); color:#9a9ea5;
  transition:all 0.15s ease;
}
.dsh-agy-chip:hover { border-color:#1677ff; color:#ffffff; }
.dsh-agy-chip.is-active {
  border-color:#1677ff;
  background:rgba(22, 119, 255, 0.15); color:#1677ff; font-weight:600;
}

/* Accounts List & Single Row Alignment */
.dsh-agy-account-list {
  max-height:480px; overflow-y:auto; padding-right:2px; display:flex; flex-direction:column; gap:6px;
}
.dsh-agy-account {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:8px 12px; border-radius:8px;
  border:1px solid rgba(255,255,255,0.08);
  background:rgba(255,255,255,0.02); transition:all 0.15s ease;
  white-space:nowrap; overflow:hidden;
}
.dsh-agy-account.is-compact {
  padding:4px 8px; min-height:30px; gap:8px;
}
.dsh-agy-account.is-active {
  border-color:#1677ff;
  background:rgba(22, 119, 255, 0.08);
}
.dsh-agy-account-main {
  display:flex; align-items:center; gap:8px; flex:1 1 0; min-width:0;
  cursor:pointer; overflow:hidden; text-overflow:ellipsis;
}
.dsh-agy-account-mail {
  font-size:13px; font-weight:500; color:#f0f0f0;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.dsh-agy-account.is-compact .dsh-agy-account-mail { font-size:12px; }
.dsh-agy-link { color:#1677ff; text-decoration:none; }
.dsh-agy-link:hover { text-decoration:underline; }

/* Right Columns Container (Always Stays in One Line) */
.dsh-agy-account-metrics {
  display:flex; align-items:center; gap:8px; flex:0 0 auto;
}

/* Clear Tooltip-Enabled Quota Capsule */
.dsh-agy-capsule-bar {
  box-sizing:border-box; width:130px; display:inline-flex; align-items:center; justify-content:space-between;
  gap:6px; font-size:11px; padding:4px 8px; border-radius:6px;
  background:rgba(255,255,255,0.06); color:#b0b4ba;
  cursor:help; user-select:none;
}
.dsh-agy-account.is-compact .dsh-agy-capsule-bar {
  width:95px; padding:2px 6px; font-size:10px;
}
.dsh-agy-capsule-progress {
  width:44px; height:6px; border-radius:3px; background:rgba(255,255,255,0.15); overflow:hidden; flex:0 0 44px;
}
.dsh-agy-account.is-compact .dsh-agy-capsule-progress {
  width:32px; height:5px; flex:0 0 32px;
}
.dsh-agy-capsule-fill { height:100%; border-radius:3px; transition:width 0.3s ease; }
.dsh-agy-capsule-fill.is-high { background:#41c977; }
.dsh-agy-capsule-fill.is-med { background:#fa8c16; }
.dsh-agy-capsule-fill.is-low { background:#f25a5a; }

/* Modern Step-by-Step Quick Setup Guide (Plan C) */
.dsh-agy-guide-card {
  display:flex; flex-direction:column; gap:12px; padding:16px 18px;
  border-radius:12px;
  background:linear-gradient(145deg, #1e222b 0%, #171920 100%);
  border:1px solid rgba(22, 119, 255, 0.25);
  box-shadow:0 4px 12px rgba(0,0,0,0.2);
}
.dsh-agy-guide-header {
  display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;
}
.dsh-agy-step {
  display:flex; gap:12px; align-items:flex-start; margin-top:2px;
}
.dsh-agy-step-num {
  width:22px; height:22px; border-radius:50%; background:#1677ff; color:#fff;
  display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;
  flex:0 0 22px; margin-top:1px;
}
.dsh-agy-step-content {
  display:flex; flex-direction:column; gap:6px; flex:1; min-width:0;
}
.dsh-agy-code-terminal {
  display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 12px;
  border-radius:8px; background:#0e1013; border:1px solid rgba(255,255,255,0.08);
  font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; color:#58a6ff;
}
`

function formatReset(iso?: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime() - Date.now()
  if (t <= 0) return ''
  const m = Math.floor(t / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return d + 'd'
  if (h > 0) return h + 'h' + (m % 60) + 'm'
  return m + 'm'
}

function getAccountQuotaMetrics(quota?: AccountQuotaSummary) {
  if (!quota?.ok || !quota.groups) return undefined
  const buckets = quota.groups.flatMap(g => g.buckets).filter(b => b.window === '5h' || b.window === 'weekly')
  const b5h = buckets.find(b => b.window === '5h')
  const bWeekly = buckets.find(b => b.window === 'weekly')
  if (!b5h && !bWeekly) return undefined

  const f5h = b5h?.remainingFraction
  const fWeekly = bWeekly?.remainingFraction
  const p5h = f5h !== undefined ? Math.round(f5h * 100) : undefined
  const pWeekly = fWeekly !== undefined ? Math.round(fWeekly * 100) : undefined

  const is5hExhausted = f5h !== undefined ? f5h <= 0 : false
  const isWeeklyExhausted = fWeekly !== undefined ? fWeekly <= 0 : false
  const isExhausted = (b5h ? is5hExhausted : true) && (bWeekly ? isWeeklyExhausted : true) && (!!b5h || !!bWeekly)

  const score = Math.min(
    f5h !== undefined ? f5h * 100 : 100,
    fWeekly !== undefined ? fWeekly * 100 : 100,
  )

  const reset5h = b5h ? formatReset(b5h.resetTime) : ''
  const resetWeekly = bWeekly ? formatReset(bWeekly.resetTime) : ''

  return { b5h, bWeekly, p5h, pWeekly, isExhausted, score, reset5h, resetWeekly }
}

function ensureThemeStyles(): void {
  if (typeof document === 'undefined') return
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = SETTINGS_CSS
}

async function jsonRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { accept: 'application/json', ...body === undefined ? {} : { 'content-type': 'application/json' } },
    credentials: 'same-origin',
    ...body === undefined ? {} : { body: JSON.stringify(body) },
  })
  const value: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message = typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
      ? value.error
      : 'HTTP ' + response.status
    throw new Error(message)
  }
  return value as T
}

export function AntigravitySettings({ t }: AntigravitySettingsProps) {
  if (t === undefined) throw new Error('Antigravity settings requires its translation function')

  const [activeTab, setActiveTab] = useState<ActiveTab>('accounts')

  // Accounts state
  const [status, setStatus] = useState<AntigravityStatus | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [quotas, setQuotas] = useState<Record<string, AccountQuotaSummary>>({})
  const [loadingQuotas, setLoadingQuotas] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'available' | 'exhausted'>('all')
  const [compactView, setCompactView] = useState(false)
  const [sortBy, setSortBy] = useState<'default' | 'quota'>('default')

  // Network state
  const [network, setNetwork] = useState<Network>()
  const [networkMessage, setNetworkMessage] = useState('')
  const [savingNetwork, setSavingNetwork] = useState(false)

  // Web2API state (Plan C with port 18088)
  const [web2apiEnabled, setWeb2apiEnabled] = useState(false)
  const [web2apiBaseUrl, setWeb2apiBaseUrl] = useState('http://127.0.0.1:18088/v1')
  const [web2apiApiKey, setWeb2apiApiKey] = useState('')
  const [web2apiImageTool, setWeb2apiImageTool] = useState(true)
  const [web2apiSaving, setWeb2apiSaving] = useState(false)
  const [web2apiTesting, setWeb2apiTesting] = useState(false)
  const [web2apiDetecting, setWeb2apiDetecting] = useState(false)
  const [web2apiFeedback, setWeb2apiFeedback] = useState<{ ok: boolean, msg: string } | null>(null)
  const [copiedDocker, setCopiedDocker] = useState(false)

  useEffect(() => { ensureThemeStyles() }, [])

  const refresh = useCallback(async () => {
    try {
      setStatus(await jsonRequest<AntigravityStatus>(STATUS_PATH))
      setError(undefined)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    }
  }, [t])

  const refreshQuotas = useCallback(async () => {
    setLoadingQuotas(true)
    try {
      const res = await jsonRequest<{ ok: boolean, quotas: Record<string, AccountQuotaSummary> }>(QUOTAS_PATH)
      if (res?.quotas) setQuotas(res.quotas)
    } catch {}
    finally { setLoadingQuotas(false) }
  }, [])

  const loadNetwork = useCallback(async () => {
    try {
      setNetwork(await jsonRequest<Network>(NETWORK_PATH))
    } catch {}
  }, [])

  const loadWeb2Api = useCallback(async () => {
    try {
      const res = await fetch(WEB2API_SETTINGS_PATH)
      if (res.ok) {
        const data = await res.json()
        setWeb2apiEnabled(Boolean(data.enabled))
        if (data.baseUrl) setWeb2apiBaseUrl(data.baseUrl)
        if (data.apiKey) setWeb2apiApiKey(data.apiKey)
        setWeb2apiImageTool(data.enableImageTool !== false)
      }
    } catch {}
  }, [])

  // Initial load: load accounts, quotas, network, and web2api together
  useEffect(() => {
    void refresh()
    void refreshQuotas()
    void loadNetwork()
    void loadWeb2Api()
  }, [refresh, refreshQuotas, loadNetwork, loadWeb2Api])

  const saveNetwork = async () => {
    if (!network) return
    setSavingNetwork(true)
    try {
      const saved = await jsonRequest<Network>(NETWORK_PATH, 'POST', network)
      setNetwork(saved)
      setNetworkMessage(t('networkSaved'))
    } catch (e: unknown) {
      setNetworkMessage(e instanceof Error ? e.message : t('saveFailed'))
    } finally {
      setSavingNetwork(false)
    }
  }

  const saveWeb2Api = async (override?: Partial<{ enabled: boolean, baseUrl: string }>) => {
    setWeb2apiSaving(true)
    setWeb2apiFeedback(null)
    const payload = {
      enabled: override?.enabled ?? web2apiEnabled,
      baseUrl: override?.baseUrl ?? web2apiBaseUrl,
      apiKey: web2apiApiKey,
      enableImageTool: web2apiImageTool,
    }
    try {
      const res = await fetch(WEB2API_SETTINGS_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setWeb2apiFeedback({ ok: true, msg: t('web2apiSaved') })
        void refresh()
      } else {
        const err = await res.text()
        setWeb2apiFeedback({ ok: false, msg: err || t('saveFailed') })
      }
    } catch (e: unknown) {
      setWeb2apiFeedback({ ok: false, msg: e instanceof Error ? e.message : t('unknownError') })
    } finally {
      setWeb2apiSaving(false)
    }
  }

  const testWeb2Api = async () => {
    setWeb2apiTesting(true)
    setWeb2apiFeedback(null)
    try {
      const res = await fetch(WEB2API_TEST_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          baseUrl: web2apiBaseUrl,
          apiKey: web2apiApiKey,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setWeb2apiFeedback({ ok: true, msg: t('web2apiConnected', { latency: data.latencyMs }) })
      } else {
        setWeb2apiFeedback({ ok: false, msg: t('web2apiFailed', { error: data.error ?? t('unknownError') }) })
      }
    } catch (e: unknown) {
      setWeb2apiFeedback({ ok: false, msg: e instanceof Error ? e.message : t('unknownError') })
    } finally {
      setWeb2apiTesting(false)
    }
  }

  // Plan C: Auto-detect local gateway
  const detectLocalGateway = async () => {
    setWeb2apiDetecting(true)
    setWeb2apiFeedback(null)
    const candidates = ['http://127.0.0.1:18088/v1', 'http://localhost:18088/v1']
    let detected = false

    for (const url of candidates) {
      try {
        const res = await fetch(WEB2API_TEST_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: true, baseUrl: url, apiKey: web2apiApiKey }),
        })
        const data = await res.json()
        if (data.ok) {
          setWeb2apiBaseUrl(url)
          setWeb2apiEnabled(true)
          setWeb2apiFeedback({ ok: true, msg: t('detectedSuccess', { url, latency: data.latencyMs }) })
          await saveWeb2Api({ enabled: true, baseUrl: url })
          detected = true
          break
        }
      } catch {}
    }

    if (!detected) {
      setWeb2apiFeedback({ ok: false, msg: t('detectedNotFound') })
    }
    setWeb2apiDetecting(false)
  }

  const copyDockerCommand = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(DOCKER_CMD)
      setCopiedDocker(true)
      setTimeout(() => setCopiedDocker(false), 2000)
    }
  }

  const signIn = async () => {
    setBusy(true)
    try {
      const challenge = await jsonRequest<{ url: string }>(LOGIN_PATH, 'POST')
      if (typeof window !== 'undefined') window.open(challenge.url, '_blank', 'noopener,noreferrer')
      void refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  const complete = async () => {
    if (draft.trim().length === 0) return
    setBusy(true)
    try {
      await jsonRequest(COMPLETE_PATH, 'POST', { url: draft.trim() })
      setDraft('')
      void refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  // Account switch with clean switching state
  const switchAccount = async (id: string) => {
    setSwitchingId(id)
    try {
      await jsonRequest(SWITCH_PATH, 'POST', { id })
      await refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      setSwitchingId(null)
    }
  }

  const removeAccount = async (id: string) => {
    setBusy(true)
    try {
      await jsonRequest(REMOVE_PATH, 'POST', { id })
      void refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  const recover = async (action: 'cancel' | 'retry') => {
    setBusy(true)
    try {
      await jsonRequest('/plugins/dsh-antigravity-oauth/auth/' + action, 'POST')
      setDraft('')
      void refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  const accounts: AccountSummary[] = useMemo(() => status?.accounts ?? [], [status])
  const activeAccountId = useMemo(() => status?.status === 'signed-in' ? status.activeId : undefined, [status])
  const activeAccount = useMemo(() => accounts.find(a => a.id === activeAccountId), [accounts, activeAccountId])

  const filteredAccounts = useMemo(() => {
    let list = accounts.slice()
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase().trim()
      list = list.filter(a =>
        a.email?.toLowerCase().includes(query)
        || a.id.toLowerCase().includes(query)
        || a.projectId?.toLowerCase().includes(query),
      )
    }
    if (filterMode === 'available') {
      list = list.filter(a => !a.limited && a.ready && !a.dead)
    } else if (filterMode === 'exhausted') {
      list = list.filter(a => a.limited || a.dead)
    }
    if (sortBy === 'quota') {
      list.sort((a, b) => {
        if (a.id === activeAccountId) return -1
        if (b.id === activeAccountId) return 1
        const qa = getAccountQuotaMetrics(quotas[a.id])?.score ?? -1
        const qb = getAccountQuotaMetrics(quotas[b.id])?.score ?? -1
        return qb - qa
      })
    }
    return list
  }, [accounts, searchQuery, filterMode, sortBy, quotas, activeAccountId])

  const signing = status?.status === 'signing-in'

  return (
    <section className="dsh-agy-page" aria-labelledby="antigravity-settings-title">
      <div className="dsh-agy-header">
        <h2 id="antigravity-settings-title" className="dsh-agy-title">{t('title')}</h2>
        <p className="dsh-agy-body">{t('tos')}</p>
      </div>

      {error ? <p className="dsh-agy-error">{error}</p> : null}

      {/* Modern High-Contrast Segmented Navigation Tabs */}
      <nav className="dsh-agy-tabs-container" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'accounts'}
          className={'dsh-agy-tab-btn ' + (activeTab === 'accounts' ? 'is-active' : '')}
          onClick={() => setActiveTab('accounts')}
        >
          <span>{t('tabAccounts')}</span>
          {accounts.length > 0 ? (
            <span className="dsh-agy-tab-count">
              {accounts.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'web2api'}
          className={'dsh-agy-tab-btn ' + (activeTab === 'web2api' ? 'is-active' : '')}
          onClick={() => setActiveTab('web2api')}
        >
          <span className={'dsh-agy-dot ' + (web2apiEnabled ? 'is-signed-in' : '')} style={{ width: '6px', height: '6px' }} />
          <span>{t('tabWeb2api')}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'network'}
          className={'dsh-agy-tab-btn ' + (activeTab === 'network' ? 'is-active' : '')}
          onClick={() => setActiveTab('network')}
        >
          <span>{t('tabNetwork')}</span>
        </button>
      </nav>

      {/* TAB 1: ACCOUNTS & QUOTA */}
      {activeTab === 'accounts' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="dsh-agy-card">
            <div className="dsh-agy-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className={'dsh-agy-dot ' + (signing ? 'is-signing-in' : activeAccount?.ready ? 'is-signed-in' : 'is-error')} />
                <div>
                  <p className="dsh-agy-card-title">{t('authStatus')}</p>
                  <p className="dsh-agy-body" style={{ fontSize: '12px' }}>
                    {signing ? t('signingIn') : activeAccount ? activeAccount.email ?? activeAccount.id : t('signedOut')}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {signing ? (
                  <button type="button" className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact" onClick={() => { void recover('cancel') }}>
                    {t('cancel')}
                  </button>
                ) : (
                  <button type="button" className="dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact" disabled={busy} onClick={() => { void signIn() }}>
                    {busy ? t('working') : accounts.length === 0 ? t('login') : t('addAccount')}
                  </button>
                )}
                {accounts.length > 0 ? (
                  <button type="button" className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact" disabled={busy || loadingQuotas} onClick={() => { void refreshQuotas() }}>
                    {loadingQuotas ? t('working') : t('refreshQuotas')}
                  </button>
                ) : null}
              </div>
            </div>
            {accounts.length > 0 ? <p className="dsh-agy-body" style={{ fontSize: '12px' }}>{t('quotaHint')}</p> : null}
          </div>

          {accounts.length > 0 ? (
            <div className="dsh-agy-card">
              <div className="dsh-agy-row" style={{ gap: '8px' }}>
                <div style={{ position: 'relative', flex: '1 1 180px' }}>
                  <input
                    type="text"
                    className="dsh-agy-input"
                    placeholder={t('searchAccountsPlaceholder')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ paddingRight: searchQuery ? '28px' : '10px' }}
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      aria-label={t('clearSearch')}
                      onClick={() => setSearchQuery('')}
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6 }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>

                <div className="dsh-agy-chips">
                  <button
                    type="button"
                    className={'dsh-agy-chip ' + (filterMode === 'all' ? 'is-active' : '')}
                    onClick={() => setFilterMode('all')}
                  >
                    {t('filterAll')} ({accounts.length})
                  </button>
                  <button
                    type="button"
                    className={'dsh-agy-chip ' + (filterMode === 'available' ? 'is-active' : '')}
                    onClick={() => setFilterMode('available')}
                  >
                    {t('filterAvailable')} ({accounts.filter(a => !a.limited && a.ready && !a.dead).length})
                  </button>
                  <button
                    type="button"
                    className={'dsh-agy-chip ' + (filterMode === 'exhausted' ? 'is-active' : '')}
                    onClick={() => setFilterMode('exhausted')}
                  >
                    {t('filterExhausted')} ({accounts.filter(a => a.limited || a.dead).length})
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={compactView} onChange={e => setCompactView(e.target.checked)} />
                    <span>{t('compactView')}</span>
                  </label>
                  <select
                    className="dsh-agy-select"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as 'default' | 'quota')}
                  >
                    <option value="default">{t('sortDefault')}</option>
                    <option value="quota">{t('sortQuota')}</option>
                  </select>
                </div>
              </div>

              {/* Strict Clean Flex Row */}
              <div className="dsh-agy-account-list">
                {filteredAccounts.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
                    {t('noMatchingAccounts')}
                  </div>
                ) : (
                  filteredAccounts.map(account => {
                    const isActive = account.id === activeAccountId
                    const isSwitching = account.id === switchingId
                    const metrics = getAccountQuotaMetrics(quotas[account.id])
                    const p5h = metrics?.p5h
                    const pWeekly = metrics?.pWeekly

                    // Guaranteed informative hover tooltip
                    const tooltip5h = p5h !== undefined
                      ? `5h Window: ${p5h}% remaining${metrics?.reset5h ? ` (${t('quotaResetsIn')} ${metrics.reset5h})` : ''}`
                      : '5h Window: Quota data not loaded (click Refresh Quotas above)'
                    const tooltipWeekly = pWeekly !== undefined
                      ? `Weekly Budget: ${pWeekly}% remaining${metrics?.resetWeekly ? ` (${t('quotaResetsIn')} ${metrics.resetWeekly})` : ''}`
                      : 'Weekly Budget: Quota data not loaded (click Refresh Quotas above)'

                    return (
                      <div
                        key={account.id}
                        className={'dsh-agy-account ' + (isActive ? 'is-active ' : '') + (compactView ? 'is-compact' : '')}
                      >
                        {/* Col 1: Account Info */}
                        <div className="dsh-agy-account-main" onClick={() => { if (!isActive && !switchingId) void switchAccount(account.id) }}>
                          <input type="radio" checked={isActive} readOnly style={{ cursor: 'pointer', flexShrink: 0 }} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="dsh-agy-account-mail">{account.email ?? account.id}</span>
                              {isSwitching ? <span className="dsh-agy-status-badge is-switching">{t('working')}...</span> : null}
                              {!isSwitching && isActive ? <span className="dsh-agy-status-badge is-success">{t('activeBadge')}</span> : null}
                              {account.limited ? <span className="dsh-agy-status-badge is-error">{t('accountLimited')}</span> : null}
                              {account.dead ? <span className="dsh-agy-status-badge is-error">{t('accountNeedsRelogin')}</span> : null}
                            </div>
                            {!compactView && account.projectId ? (
                              <span style={{ fontSize: '11px', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis' }}>{account.projectId}</span>
                            ) : null}
                          </div>
                        </div>

                        {/* Col 2: Metrics container */}
                        <div className="dsh-agy-account-metrics">
                          {/* 5h Capsule with Guaranteed Hover Tooltip */}
                          <div className="dsh-agy-capsule-bar" title={tooltip5h}>
                            <span>{t('quota5h')} {p5h !== undefined ? p5h + '%' : '--'}</span>
                            <div className="dsh-agy-capsule-progress">
                              <div
                                className={'dsh-agy-capsule-fill ' + ((p5h ?? 0) > 40 ? 'is-high' : (p5h ?? 0) > 15 ? 'is-med' : 'is-low')}
                                style={{ width: (p5h ?? 0) + '%' }}
                              />
                            </div>
                          </div>

                          {/* Weekly Capsule with Guaranteed Hover Tooltip */}
                          <div className="dsh-agy-capsule-bar" title={tooltipWeekly}>
                            <span>{t('quotaWeeklyShort')} {pWeekly !== undefined ? pWeekly + '%' : '--'}</span>
                            <div className="dsh-agy-capsule-progress">
                              <div
                                className={'dsh-agy-capsule-fill ' + ((pWeekly ?? 0) > 40 ? 'is-high' : (pWeekly ?? 0) > 15 ? 'is-med' : 'is-low')}
                                style={{ width: (pWeekly ?? 0) + '%' }}
                              />
                            </div>
                          </div>

                          {/* Remove button (hidden in compact view for maximal density) */}
                          {!compactView ? (
                            <div style={{ width: '64px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                              {!isActive ? (
                                <button
                                  type="button"
                                  className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
                                  disabled={busy || Boolean(switchingId)}
                                  onClick={() => { void removeAccount(account.id) }}
                                >
                                  {t('removeAccount')}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ) : null}

          {signing && status?.url ? (
            <div className="dsh-agy-card">
              <p className="dsh-agy-body">
                {t('openUrl')} <a href={status.url} target="_blank" rel="noreferrer" className="dsh-agy-link">{t('reopen')}</a>
              </p>
              <form className="dsh-agy-form" onSubmit={e => { e.preventDefault(); void complete() }} style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <input
                  type="text"
                  className="dsh-agy-input"
                  placeholder={t('completePlaceholder')}
                  value={draft}
                  disabled={busy}
                  onChange={e => setDraft(e.target.value)}
                />
                <button type="submit" className="dsh-agy-btn dsh-agy-btn-primary" disabled={busy || draft.trim().length === 0}>
                  {busy ? t('working') : t('complete')}
                </button>
              </form>
            </div>
          ) : null}

          {activeAccount !== undefined && !activeAccount.ready ? (
            <button
              type="button"
              className="dsh-agy-btn dsh-agy-btn-primary"
              disabled={busy}
              onClick={() => { void recover('retry') }}
            >
              {busy ? t('working') : t('retryEligibility')}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* TAB 2: WEB2API GATEWAY (PLAN C) */}
      {activeTab === 'web2api' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Redesigned Quick Setup Guide Card with Modern Stepper */}
          <div className="dsh-agy-guide-card">
            <div className="dsh-agy-guide-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🚀</span>
                <p className="dsh-agy-card-title" style={{ fontSize: '15px' }}>{t('quickSetupTitle')}</p>
              </div>
              <span className="dsh-agy-status-badge is-success">Docker / Binary Ready</span>
            </div>
            <p className="dsh-agy-body" style={{ color: '#c0c4cc' }}>{t('quickSetupDesc')}</p>

            {/* Step 1 */}
            <div className="dsh-agy-step">
              <div className="dsh-agy-step-num">1</div>
              <div className="dsh-agy-step-content">
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0' }}>{t('step1Title')}</span>
                <span className="dsh-agy-body" style={{ fontSize: '12px' }}>{t('step1Desc')}</span>
                <div className="dsh-agy-code-terminal">
                  <code style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{DOCKER_CMD}</code>
                  <button
                    type="button"
                    className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
                    style={{ flexShrink: 0 }}
                    onClick={copyDockerCommand}
                  >
                    {copiedDocker ? t('copied') : t('copyCommand')}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="dsh-agy-step">
              <div className="dsh-agy-step-num">2</div>
              <div className="dsh-agy-step-content">
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0' }}>{t('step2Title')}</span>
                <span className="dsh-agy-body" style={{ fontSize: '12px' }}>{t('step2Desc')}</span>
                <div>
                  <button
                    type="button"
                    className="dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact"
                    style={{ padding: '4px 14px' }}
                    disabled={web2apiDetecting}
                    onClick={() => { void detectLocalGateway() }}
                  >
                    {web2apiDetecting ? t('detecting') : t('detectService')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Gateway Configuration Card */}
          <div className="dsh-agy-card">
            <div className="dsh-agy-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={'dsh-agy-dot ' + (web2apiEnabled ? 'is-signed-in' : '')} />
                <p className="dsh-agy-card-title">{t('web2apiTitle')}</p>
                <span className={'dsh-agy-status-badge ' + (web2apiEnabled ? 'is-success' : '')}>
                  {web2apiEnabled ? t('statusConnected') : t('statusDisabled')}
                </span>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={web2apiEnabled}
                  disabled={web2apiSaving}
                  onChange={e => setWeb2apiEnabled(e.target.checked)}
                />
                <span>{t('web2apiEnable')}</span>
              </label>
            </div>

            <p className="dsh-agy-body">{t('web2apiHelp')}</p>

            {web2apiEnabled ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', opacity: 0.7 }}>{t('presetLocal')}:</span>
                  <button
                    type="button"
                    className="dsh-agy-chip"
                    onClick={() => setWeb2apiBaseUrl('http://127.0.0.1:18088/v1')}
                  >
                    127.0.0.1:18088
                  </button>
                  <button
                    type="button"
                    className="dsh-agy-chip"
                    onClick={() => setWeb2apiBaseUrl('http://localhost:18088/v1')}
                  >
                    localhost:18088
                  </button>
                </div>

                <div>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                    {t('web2apiBaseUrl')}
                  </label>
                  <input
                    type="text"
                    className="dsh-agy-input"
                    placeholder="http://127.0.0.1:18088/v1"
                    value={web2apiBaseUrl}
                    disabled={web2apiSaving}
                    onChange={e => setWeb2apiBaseUrl(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                    {t('web2apiApiKey')}
                  </label>
                  <input
                    type="password"
                    className="dsh-agy-input"
                    placeholder="sk-..."
                    value={web2apiApiKey}
                    disabled={web2apiSaving}
                    onChange={e => setWeb2apiApiKey(e.target.value)}
                  />
                </div>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={web2apiImageTool}
                    disabled={web2apiSaving}
                    onChange={e => setWeb2apiImageTool(e.target.checked)}
                  />
                  <span>{t('web2apiImageTool')}</span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
                    disabled={web2apiTesting || web2apiSaving}
                    onClick={() => { void testWeb2Api() }}
                  >
                    {web2apiTesting ? t('web2apiTesting') : t('web2apiTest')}
                  </button>
                  <button
                    type="button"
                    className="dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact"
                    disabled={web2apiSaving}
                    onClick={() => { void saveWeb2Api() }}
                  >
                    {web2apiSaving ? t('web2apiSaving') : t('web2apiSave')}
                  </button>
                </div>

                {web2apiFeedback ? (
                  <p className={web2apiFeedback.ok ? 'dsh-agy-body' : 'dsh-agy-error'} style={{ marginTop: '2px', fontSize: '12px' }}>
                    {web2apiFeedback.msg}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Credit Banner */}
          <div className="dsh-agy-card" style={{ background: 'transparent', opacity: 0.85 }}>
            <div className="dsh-agy-row">
              <p className="dsh-agy-card-title" style={{ fontSize: '13px' }}>{t('creditTitle')}</p>
              <a
                href="https://github.com/zexadev/gemini-web2api-go"
                target="_blank"
                rel="noreferrer"
                className="dsh-agy-link"
                style={{ fontSize: '12px' }}
              >
                {t('visitRepo')} →
              </a>
            </div>
            <p className="dsh-agy-body" style={{ fontSize: '12px' }}>{t('creditBody')}</p>
          </div>
        </div>
      ) : null}

      {/* TAB 3: NETWORK & PROXY */}
      {activeTab === 'network' && network ? (
        <div className="dsh-agy-card">
          <p className="dsh-agy-card-title">{t('network')}</p>
          <p className="dsh-agy-body">{t('networkHelp')}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
            <label style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span>{t('network')}</span>
              <select
                className="dsh-agy-select"
                aria-label={t('network')}
                value={network.mode}
                disabled={savingNetwork}
                onChange={e => setNetwork({ ...network, mode: e.target.value as Network['mode'] })}
              >
                <option value="auto">{t('networkAuto')}</option>
                <option value="direct">{t('networkDirect')}</option>
                <option value="proxy">{t('networkProxy')}</option>
              </select>
            </label>

            {network.mode === 'proxy' ? (
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>{t('proxyUrl')}</label>
                <input
                  type="text"
                  className="dsh-agy-input"
                  aria-label={t('proxyUrl')}
                  placeholder="http://127.0.0.1:7890"
                  value={network.url}
                  disabled={savingNetwork}
                  onChange={e => setNetwork({ ...network, url: e.target.value })}
                />
              </div>
            ) : null}

            <p className="dsh-agy-body" style={{ fontSize: '12px' }}>
              {t('effectiveNetwork')} <code>{network.effective || 'direct'}</code>
            </p>

            <button
              type="button"
              className="dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact"
              style={{ width: 'fit-content' }}
              disabled={savingNetwork}
              onClick={() => { void saveNetwork() }}
            >
              {savingNetwork ? t('working') : t('saveNetwork')}
            </button>

            {networkMessage ? (
              <p role="status" className="dsh-agy-body" style={{ fontSize: '12px' }}>
                {networkMessage}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
