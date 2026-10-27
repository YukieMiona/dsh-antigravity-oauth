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
const DISMISSED_NOTICE_KEY = 'dsh-antigravity-oauth.dismissed-notice'

type Network = { mode: 'auto' | 'direct' | 'proxy', url: string, effective: string }
type ActiveTab = 'accounts' | 'web2api' | 'network'

export interface AntigravitySettingsInjected {
  t: (key: AntigravityKey, params?: Record<string, unknown>) => string
}

export type AntigravitySettingsProps = Partial<AntigravitySettingsInjected>

const SETTINGS_CSS = `
.dsh-agy-page { display:flex; flex-direction:column; gap:12px; width:100%; max-width:800px; color:#e0e0e0; font-family:inherit; position:relative; }
.dsh-agy-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }
.dsh-agy-title-row { display:flex; align-items:center; gap:12px; }
.dsh-agy-title { margin:0; font-size:18px; line-height:24px; font-weight:600; color:#ffffff; }
.dsh-agy-body { margin:0; font-size:12px; line-height:18px; color:#9a9ea5; }
.dsh-agy-error { margin:0; font-size:12px; line-height:18px; color:#f25a5a; padding:6px 12px; border-radius:6px; background:rgba(242,90,90,0.12); border:1px solid rgba(242,90,90,0.25); }

/* Fixed Floating Notification (Zero Layout Shift) */
.dsh-agy-toast-float {
  position:fixed; top:24px; right:24px; z-index:9999;
  display:flex; align-items:center; gap:8px;
  padding:10px 16px; border-radius:8px;
  background:#1a231e; border:1px solid #41c977;
  color:#41c977; font-size:13px; font-weight:500;
  box-shadow:0 8px 24px rgba(0,0,0,0.4);
  animation:dsh-agy-fadein 0.2s ease-out;
}
@keyframes dsh-agy-fadein { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }

/* Dismissible Description Banner */
.dsh-agy-notice-banner {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:8px 12px; border-radius:8px;
  background:#1e2023; border:1px solid rgba(255,255,255,0.06);
}
.dsh-agy-notice-close {
  background:none; border:none; color:#9a9ea5; cursor:pointer;
  font-size:16px; line-height:1; padding:2px 6px; border-radius:4px;
}
.dsh-agy-notice-close:hover { color:#ffffff; background:rgba(255,255,255,0.08); }

/* Modern Segmented Navigation Tabs */
.dsh-agy-tabs-container {
  display:inline-flex; align-items:center; gap:4px; padding:3px;
  background:#1a1c1e !important;
  border:1px solid rgba(255,255,255,0.1) !important;
  border-radius:10px; width:fit-content;
}
.dsh-agy-tab-btn {
  display:inline-flex; align-items:center; gap:6px; padding:6px 14px;
  border:none !important; border-radius:7px !important;
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

/* Slim Compact Status Bar */
.dsh-agy-compact-auth {
  display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;
  padding:8px 12px; border-radius:8px;
  background:#1e2023; border:1px solid rgba(255,255,255,0.08);
}
.dsh-agy-compact-auth-left { display:flex; align-items:center; gap:8px; font-size:12px; }

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

/* Buttons */
.dsh-agy-btn {
  box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center;
  min-height:28px; padding:3px 12px; border-radius:6px; font:inherit; font-size:12px; line-height:18px;
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
.dsh-agy-btn-compact { min-height:22px; padding:1px 8px; font-size:11px; border-radius:4px; }

/* Inputs */
.dsh-agy-input {
  box-sizing:border-box; width:100%; min-height:30px; padding:4px 8px; border-radius:6px;
  border:1px solid rgba(255,255,255,0.12);
  background:#141517; color:#f0f0f0;
  font:inherit; font-size:12px; outline:none; transition:border-color 0.15s ease;
}
.dsh-agy-input:focus { border-color:#1677ff; }
.dsh-agy-select {
  box-sizing:border-box; min-height:26px; padding:2px 8px; border-radius:6px;
  border:1px solid rgba(255,255,255,0.12);
  background:#141517; color:#f0f0f0;
  font:inherit; font-size:11px; cursor:pointer; outline:none;
}

/* Accounts List */
.dsh-agy-account-list {
  max-height:520px; overflow-y:auto; padding-right:2px; display:flex; flex-direction:column; gap:6px;
}
.dsh-agy-account {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:8px 12px; border-radius:8px;
  border:1px solid rgba(255,255,255,0.08);
  background:rgba(255,255,255,0.02); transition:all 0.15s ease;
  overflow:hidden; cursor:pointer;
}
.dsh-agy-account:hover { background:rgba(255,255,255,0.04); }
.dsh-agy-account.is-active {
  border-color:#1677ff;
  background:rgba(22, 119, 255, 0.08);
}

/* Compact mode: absolute single line */
.dsh-agy-account.is-compact {
  padding:3px 10px; min-height:28px; gap:8px;
}
.dsh-agy-account-main {
  display:flex; align-items:center; gap:8px; flex:1 1 0; min-width:0; overflow:hidden;
}
.dsh-agy-account-mail {
  font-size:13px; font-weight:500; color:#f0f0f0;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.dsh-agy-account.is-compact .dsh-agy-account-mail { font-size:12px; }

/* Metrics container */
.dsh-agy-account-metrics {
  display:flex; align-items:center; gap:8px; flex:0 0 auto;
}

/* Standard Quota Capsule */
.dsh-agy-capsule-bar {
  box-sizing:border-box; width:135px; display:flex; flex-direction:column;
  gap:2px; padding:3px 8px; border-radius:6px;
  background:rgba(255,255,255,0.06); color:#b0b4ba;
  user-select:none;
}
.dsh-agy-capsule-header {
  display:flex; align-items:center; justify-content:space-between; width:100%; font-size:11px;
}
.dsh-agy-capsule-progress {
  width:44px; height:6px; border-radius:3px; background:rgba(255,255,255,0.15); overflow:hidden; flex:0 0 44px;
}
.dsh-agy-capsule-fill { height:100%; border-radius:3px; transition:width 0.3s ease; }
.dsh-agy-capsule-fill.is-high { background:#41c977; }
.dsh-agy-capsule-fill.is-med { background:#fa8c16; }
.dsh-agy-capsule-fill.is-low { background:#f25a5a; }
.dsh-agy-capsule-reset {
  font-size:10px; opacity:0.75; line-height:12px; white-space:nowrap;
}

/* Compact View: Strictly synchronized single-line layout for BOTH 5h and weekly quotas */
.dsh-agy-account.is-compact .dsh-agy-capsule-bar {
  width:95px; height:22px; flex-direction:row; align-items:center; justify-content:space-between;
  padding:2px 6px; gap:4px;
}
.dsh-agy-account.is-compact .dsh-agy-capsule-header {
  display:flex; align-items:center; justify-content:space-between; width:100%; font-size:10px;
}
.dsh-agy-account.is-compact .dsh-agy-capsule-progress {
  width:32px; height:5px; flex:0 0 32px;
}
.dsh-agy-account.is-compact .dsh-agy-capsule-reset {
  display:none;
}

/* Modern Stepper Card (Plan C) */
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
  // If the time is within a slight negative drift (e.g. clock skew < 1 min), count as 1m
  if (t <= 0) return '1m'
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
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [quotas, setQuotas] = useState<Record<string, AccountQuotaSummary>>({})
  const [loadingQuotas, setLoadingQuotas] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [compactView, setCompactView] = useState(false)
  const [sortBy, setSortBy] = useState<'default' | 'quota'>('default')

  // Notice banner dismiss state (persists across reloads)
  const [noticeDismissed, setNoticeDismissed] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(DISMISSED_NOTICE_KEY) === 'true'
    }
    return false
  })

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

  useEffect(() => {
    void refresh()
    void refreshQuotas()
    void loadNetwork()
    void loadWeb2Api()
  }, [refresh, refreshQuotas, loadNetwork, loadWeb2Api])

  const dismissNotice = () => {
    setNoticeDismissed(true)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DISMISSED_NOTICE_KEY, 'true')
    }
  }

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

  // Account switch with verified server return + non-intrusive floating toast
  const switchAccount = async (targetAccount: AccountSummary) => {
    setSwitchingId(targetAccount.id)
    setError(undefined)
    try {
      const res = await jsonRequest<{ ok: boolean, account?: AntigravityStatus }>(SWITCH_PATH, 'POST', { id: targetAccount.id })
      if (res?.account) {
        setStatus(res.account)
      } else {
        await refresh()
      }
      setToastMessage(t('accountSwitched', { email: targetAccount.email ?? targetAccount.id }))
      setTimeout(() => setToastMessage(null), 3000)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
      await refresh()
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
  }, [accounts, searchQuery, sortBy, quotas, activeAccountId])

  const signing = status?.status === 'signing-in'

  return (
    <section className="dsh-agy-page" aria-labelledby="antigravity-settings-title">
      {/* Floating Top-Right Toast Notification (Zero Layout Shift) */}
      {toastMessage ? (
        <div className="dsh-agy-toast-float">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      ) : null}

      <div className="dsh-agy-header">
        <div className="dsh-agy-title-row">
          <h2 id="antigravity-settings-title" className="dsh-agy-title">{t('title')}</h2>
        </div>

        {/* Navigation Tabs */}
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
      </div>

      {/* Dismissible Description Banner (Controlled by Compact View & Dismiss Button) */}
      {!noticeDismissed && !compactView ? (
        <div className="dsh-agy-notice-banner">
          <p className="dsh-agy-body" style={{ margin: 0 }}>{t('tos')}</p>
          <button
            type="button"
            className="dsh-agy-notice-close"
            title={t('dismissNotice')}
            onClick={dismissNotice}
          >
            ×
          </button>
        </div>
      ) : null}

      {error ? <p className="dsh-agy-error">{error}</p> : null}

      {/* TAB 1: ACCOUNTS & QUOTA */}
      {activeTab === 'accounts' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Streamlined Status Bar with Integrated Compact View Toggle */}
          <div className="dsh-agy-compact-auth">
            <div className="dsh-agy-compact-auth-left">
              <span className={'dsh-agy-dot ' + (signing ? 'is-signing-in' : activeAccount?.ready ? 'is-signed-in' : 'is-error')} />
              <span>{t('authStatus')}:</span>
              <strong style={{ color: '#ffffff' }}>
                {signing ? t('signingIn') : activeAccount ? activeAccount.email ?? activeAccount.id : t('signedOut')}
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Compact View Checkbox Moved Directly Above to Action Bar */}
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', color: '#b0b4ba' }}>
                <input type="checkbox" checked={compactView} onChange={e => setCompactView(e.target.checked)} />
                <span>{t('compactView')}</span>
              </label>

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

          {accounts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Clean Filter Toolbar (Without All/Exhausted Separators) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
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
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6, color: '#fff' }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#9a9ea5' }}>{accounts.length} {t('accounts')}</span>
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

              {/* Accounts List (Directly in First Screen!) */}
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

                    return (
                      <div
                        key={account.id}
                        className={'dsh-agy-account ' + (isActive ? 'is-active ' : '') + (compactView ? 'is-compact' : '')}
                        onClick={() => { if (!isActive && !switchingId) void switchAccount(account) }}
                      >
                        {/* Account Info */}
                        <div className="dsh-agy-account-main">
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

                        {/* Quota Metrics Container */}
                        <div className="dsh-agy-account-metrics" onClick={e => e.stopPropagation()}>
                          {/* 5h Capsule */}
                          <div
                            className="dsh-agy-capsule-bar"
                            title={'5h Window: ' + (p5h !== undefined ? p5h + '%' : '--') + (metrics?.reset5h ? ' (' + metrics.reset5h + ')' : '')}
                          >
                            <div className="dsh-agy-capsule-header">
                              <span>{t('quota5h')} {p5h !== undefined ? p5h + '%' : '--'}</span>
                              <div className="dsh-agy-capsule-progress">
                                <div
                                  className={'dsh-agy-capsule-fill ' + ((p5h ?? 0) > 40 ? 'is-high' : (p5h ?? 0) > 15 ? 'is-med' : 'is-low')}
                                  style={{ width: (p5h ?? 0) + '%' }}
                                />
                              </div>
                            </div>
                            {!compactView && metrics?.reset5h ? (
                              <span className="dsh-agy-capsule-reset">{t('resetsIn', { time: metrics.reset5h })}</span>
                            ) : null}
                          </div>

                          {/* Weekly Capsule */}
                          <div
                            className="dsh-agy-capsule-bar"
                            title={'Weekly Budget: ' + (pWeekly !== undefined ? pWeekly + '%' : '--') + (metrics?.resetWeekly ? ' (' + metrics.resetWeekly + ')' : '')}
                          >
                            <div className="dsh-agy-capsule-header">
                              <span>{t('quotaWeeklyShort')} {pWeekly !== undefined ? pWeekly + '%' : '--'}</span>
                              <div className="dsh-agy-capsule-progress">
                                <div
                                  className={'dsh-agy-capsule-fill ' + ((pWeekly ?? 0) > 40 ? 'is-high' : (pWeekly ?? 0) > 15 ? 'is-med' : 'is-low')}
                                  style={{ width: (pWeekly ?? 0) + '%' }}
                                />
                              </div>
                            </div>
                            {!compactView && metrics?.resetWeekly ? (
                              <span className="dsh-agy-capsule-reset">{t('resetsIn', { time: metrics.resetWeekly })}</span>
                            ) : null}
                          </div>

                          {/* Remove button (Only in default view) */}
                          {!compactView ? (
                            <div style={{ width: '60px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
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
            <div style={{ padding: '12px', borderRadius: '8px', background: '#1e2023', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="dsh-agy-body">
                {t('openUrl')} <a href={status.url} target="_blank" rel="noreferrer" style={{ color: '#1677ff', textDecoration: 'underline' }}>{t('reopen')}</a>
              </p>
              <form onSubmit={e => { e.preventDefault(); void complete() }} style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
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
          {/* Modern Stepper Quick Setup Guide */}
          <div className="dsh-agy-guide-card">
            <div className="dsh-agy-guide-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🚀</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{t('quickSetupTitle')}</span>
              </div>
              <span className="dsh-agy-status-badge is-success">Docker / Binary Ready</span>
            </div>
            <p className="dsh-agy-body" style={{ color: '#b0b4ba' }}>{t('quickSetupDesc')}</p>

            <div className="dsh-agy-step">
              <div className="dsh-agy-step-num">1</div>
              <div className="dsh-agy-step-content">
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#f0f0f0' }}>{t('step1Title')}</span>
                <span className="dsh-agy-body" style={{ fontSize: '11px' }}>{t('step1Desc')}</span>
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

            <div className="dsh-agy-step">
              <div className="dsh-agy-step-num">2</div>
              <div className="dsh-agy-step-content">
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#f0f0f0' }}>{t('step2Title')}</span>
                <span className="dsh-agy-body" style={{ fontSize: '11px' }}>{t('step2Desc')}</span>
                <div>
                  <button
                    type="button"
                    className="dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact"
                    style={{ padding: '3px 12px' }}
                    disabled={web2apiDetecting}
                    onClick={() => { void detectLocalGateway() }}
                  >
                    {web2apiDetecting ? t('detecting') : t('detectService')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Gateway Settings Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px 16px', borderRadius: '10px', background: '#1e2023', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={'dsh-agy-dot ' + (web2apiEnabled ? 'is-signed-in' : '')} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{t('web2apiTitle')}</span>
                <span className={'dsh-agy-status-badge ' + (web2apiEnabled ? 'is-success' : '')}>
                  {web2apiEnabled ? t('statusConnected') : t('statusDisabled')}
                </span>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{t('presetLocal')}:</span>
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
                  <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px', fontWeight: 500, color: '#b0b4ba' }}>
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
                  <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px', fontWeight: 500, color: '#b0b4ba' }}>
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

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
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
                  <p className={web2apiFeedback.ok ? 'dsh-agy-toast-float' : 'dsh-agy-error'} style={{ marginTop: '2px', fontSize: '11px' }}>
                    {web2apiFeedback.msg}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Credit Banner */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{t('creditTitle')}</span>
              <a
                href="https://github.com/zexadev/gemini-web2api-go"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '11px', color: '#1677ff', textDecoration: 'none' }}
              >
                {t('visitRepo')} →
              </a>
            </div>
            <p className="dsh-agy-body" style={{ fontSize: '11px' }}>{t('creditBody')}</p>
          </div>
        </div>
      ) : null}

      {/* TAB 3: NETWORK & PROXY */}
      {activeTab === 'network' && network ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px 16px', borderRadius: '10px', background: '#1e2023', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{t('network')}</span>
          <p className="dsh-agy-body">{t('networkHelp')}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            <label style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px', color: '#b0b4ba' }}>
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
                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px', color: '#b0b4ba' }}>{t('proxyUrl')}</label>
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

            <p className="dsh-agy-body" style={{ fontSize: '11px' }}>
              {t('effectiveNetwork')} <code style={{ color: '#58a6ff' }}>{network.effective || 'direct'}</code>
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
              <p role="status" className="dsh-agy-toast-float" style={{ fontSize: '11px' }}>
                {networkMessage}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
