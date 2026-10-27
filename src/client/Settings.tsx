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
const ADVANCED_PATH = '/plugins/dsh-antigravity-oauth/advanced'
const NETWORK_PATH = '/plugins/dsh-antigravity-oauth/network'
const WEB2API_SETTINGS_PATH = '/plugins/dsh-antigravity-oauth/web2api/settings'
const WEB2API_TEST_PATH = '/plugins/dsh-antigravity-oauth/web2api/test'

const STYLE_ID = 'dsh-antigravity-oauth-settings-theme'
const DOCKER_CMD = 'docker run -d --name gemini-web2api -p 18088:18088 zexadev/gemini-web2api-go:latest'
const DISMISSED_BANNER_KEY = 'dsh-antigravity-oauth.dismissed-banner'
const DISMISSED_WEB2API_GUIDE_KEY = 'dsh-antigravity-oauth.dismissed-web2api-guide'

type Network = { mode: 'auto' | 'direct' | 'proxy', url: string, effective: string }
type ActiveTab = 'accounts' | 'advanced' | 'web2api' | 'network'

export interface AntigravitySettingsInjected {
  t: (key: AntigravityKey, params?: Record<string, unknown>) => string
}

export type AntigravitySettingsProps = Partial<AntigravitySettingsInjected>

const SETTINGS_CSS = `
.dsh-agy-page { display:flex; flex-direction:column; gap:12px; width:100%; max-width:720px; color:var(--dsw-alias-label-primary, #e0e0e0); font-family:inherit; position:relative; }

/* Top Header */
.dsh-agy-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
.dsh-agy-title-row { display:flex; align-items:center; gap:10px; }
.dsh-agy-title { margin:0; font-size:18px; line-height:24px; font-weight:600; color:var(--dsw-alias-label-primary, #ffffff); }
.dsh-agy-header-active-badge {
  display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:12px;
  font-size:12px; font-weight:500; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
  color:#f0f0f0; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.dsh-agy-body { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-secondary, #9aa0a6); }
.dsh-agy-error { margin:0; font-size:12px; line-height:18px; color:#f25a5a; padding:6px 12px; border-radius:6px; background:rgba(242,90,90,0.12); border:1px solid rgba(242,90,90,0.25); }

/* Floating Top-Right Toast Notification (Zero Layout Shift) */
.dsh-agy-toast-float {
  position:fixed; top:24px; right:24px; z-index:9999;
  display:flex; align-items:center; gap:8px;
  padding:10px 16px; border-radius:8px;
  background:#1a231e; border:1px solid #41c977;
  color:#41c977; font-size:13px; font-weight:500;
  box-shadow:0 8px 24px rgba(0,0,0,0.45);
  animation:dsh-agy-fadein 0.2s ease-out;
}
@keyframes dsh-agy-fadein { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }

/* One-time dismissible notice banner */
.dsh-agy-notice-banner {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:8px 12px; border-radius:8px;
  background:var(--dsw-alias-bg-module-platform, rgba(128,128,128,0.08));
  border:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.2));
}
.dsh-agy-notice-close {
  background:none; border:none; color:var(--dsw-alias-label-secondary, #9aa0a6); cursor:pointer;
  font-size:16px; line-height:1; padding:2px 6px; border-radius:4px;
}
.dsh-agy-notice-close:hover { color:#ffffff; background:rgba(255,255,255,0.08); }

/* Navigation Tabs */
.dsh-agy-tabs {
  display:inline-flex; align-items:center; gap:4px; padding:3px;
  background:#1a1c1e !important;
  border:1px solid rgba(255,255,255,0.12) !important;
  border-radius:10px; width:fit-content; margin-bottom:2px;
}
.dsh-agy-tab-btn {
  display:inline-flex; align-items:center; gap:6px; padding:6px 14px;
  border:none !important; border-radius:7px !important;
  background:transparent !important;
  color:#9a9ea5 !important; font:inherit; font-size:13px; font-weight:500;
  cursor:pointer; transition:all 0.15s ease; user-select:none;
}
.dsh-agy-tab-btn:hover { color:#ffffff !important; background:rgba(255,255,255,0.06) !important; }
.dsh-agy-tab-btn.is-active {
  color:#ffffff !important; background:#1677ff !important;
  box-shadow:0 1px 4px rgba(22, 119, 255, 0.4) !important; font-weight:600 !important;
}

/* Cards */
.dsh-agy-card {
  display:flex; flex-direction:column; gap:10px; padding:12px 14px;
  border:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.2));
  border-radius:10px; background:var(--dsw-alias-bg-module-platform, rgba(128,128,128,0.04));
  box-sizing:border-box; width:100%;
}
.dsh-agy-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; }
.dsh-agy-card-title { margin:0; font-size:14px; font-weight:600; color:var(--dsw-alias-label-primary, #ffffff); display:flex; align-items:center; gap:8px; }

/* Status Badges */
.dsh-agy-status-badge {
  display:inline-flex; align-items:center; justify-content:center; gap:4px;
  padding:2px 8px; border-radius:6px; min-width:54px;
  font-size:11px; font-weight:500; background:rgba(128,128,128,0.1); color:var(--dsw-alias-label-secondary, #9aa0a6);
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
  border:1px solid #1677ff !important; box-shadow:0 1px 2px rgba(0,0,0,0.15); font-weight:500;
}
.dsh-agy-btn-primary:hover:not(:disabled) { background:#0958d9 !important; border-color:#0958d9 !important; }
.dsh-agy-btn-secondary {
  border:1px solid rgba(255,255,255,0.15) !important;
  background:#2b2d30 !important; color:#f0f0f0 !important;
}
.dsh-agy-btn-secondary:hover:not(:disabled) {
  background:#3c3f41 !important; border-color:#1677ff !important; color:#ffffff !important;
}
.dsh-agy-btn-compact { min-height:22px; padding:1px 8px; font-size:11px; border-radius:4px; min-width:54px; }

/* Inputs */
.dsh-agy-input {
  box-sizing:border-box; width:100%; min-height:30px; padding:4px 8px; border-radius:6px;
  border:1px solid rgba(255,255,255,0.15);
  background:var(--dsw-alias-bg-page-primary, #1e1e1e); color:#f0f0f0;
  font:inherit; font-size:12px; outline:none; transition:border-color 0.15s ease;
}
.dsh-agy-input:focus { border-color:#1677ff; }
.dsh-agy-select {
  box-sizing:border-box; min-height:26px; padding:2px 6px; border-radius:6px;
  border:1px solid rgba(255,255,255,0.15);
  background:var(--dsw-alias-bg-page-primary, #1e1e1e); color:#f0f0f0;
  font:inherit; font-size:11px; cursor:pointer; outline:none;
}

/* Filter Chips */
.dsh-agy-chips { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.dsh-agy-chip {
  padding:2px 8px; border-radius:10px; font-size:11px; cursor:pointer;
  border:1px solid rgba(255,255,255,0.12);
  background:rgba(255,255,255,0.05); color:#9a9ea5;
  transition:all 0.15s ease;
}
.dsh-agy-chip:hover { border-color:#1677ff; color:#ffffff; }
.dsh-agy-chip.is-active {
  border-color:#1677ff; background:rgba(22, 119, 255, 0.18); color:#1677ff; font-weight:600;
}

/* Accounts List & Items */
.dsh-agy-account-list {
  max-height:480px; overflow-y:scroll; padding-right:4px; display:flex; flex-direction:column; gap:5px;
  box-sizing:border-box; width:100%;
}
.dsh-agy-account-list.is-compact-mode {
  gap:3px;
}
.dsh-agy-account {
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:8px 12px; border-radius:8px;
  border:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.2));
  background:var(--dsw-alias-bg-module-platform, transparent); transition:all 0.15s ease;
  overflow:hidden; box-sizing:border-box; cursor:pointer;
}
.dsh-agy-account:hover {
  background:rgba(255,255,255,0.04);
}
.dsh-agy-account.is-active {
  border-color:#1677ff;
  background:rgba(22, 119, 255, 0.06);
}

/* Compact mode: truly dense and slim */
.dsh-agy-account.is-compact {
  padding:4px 12px; min-height:32px;
}
.dsh-agy-account-main {
  display:flex; align-items:center; gap:8px; flex:1 1 0; min-width:0; overflow:hidden;
}
.dsh-agy-account-mail {
  font-size:13px; font-weight:500; color:#f0f0f0;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.dsh-agy-link { color:#1677ff; text-decoration:none; }
.dsh-agy-link:hover { text-decoration:underline; }

.dsh-agy-account-metrics {
  display:flex; align-items:center; gap:8px; flex:0 0 auto;
}
.dsh-agy-account.is-compact .dsh-agy-account-metrics {
  gap:6px;
}

/* Quota Capsule Bars */
.dsh-agy-capsule-bar {
  box-sizing:border-box; width:130px; display:inline-flex; align-items:center; justify-content:space-between;
  gap:6px; font-size:11px; padding:3px 8px; border-radius:6px;
  background:rgba(128,128,128,0.1); color:#9aa0a6; cursor:help; user-select:none;
}
.dsh-agy-account.is-compact .dsh-agy-capsule-bar {
  padding:2px 8px; height:24px;
}
.dsh-agy-capsule-progress {
  width:42px; height:6px; border-radius:3px; background:rgba(128,128,128,0.25); overflow:hidden; flex:0 0 42px;
}
.dsh-agy-capsule-fill { height:100%; border-radius:3px; transition:width 0.3s ease; }
.dsh-agy-capsule-fill.is-high { background:#41c977; }
.dsh-agy-capsule-fill.is-med { background:#fa8c16; }
.dsh-agy-capsule-fill.is-low { background:#f25a5a; }

/* Rightmost Action Cell: Aligns Active badge and Remove button */
.dsh-agy-account-action {
  width:64px; display:flex; align-items:center; justify-content:flex-end; flex-shrink:0;
}
.dsh-agy-action-pill {
  box-sizing:border-box !important; width:58px !important; height:22px !important;
  min-height:22px !important; max-height:22px !important; padding:0 !important;
  font-size:11px !important; font-weight:500 !important; line-height:20px !important;
  border-radius:5px !important; display:inline-flex !important; align-items:center !important;
  justify-content:center !important; text-align:center !important; user-select:none;
}
.dsh-agy-action-pill.is-active-badge {
  background:rgba(34,160,107,0.2) !important; color:#41c977 !important;
  border:1px solid rgba(34,160,107,0.4) !important; font-weight:600 !important;
}
.dsh-agy-action-pill.is-remove-btn {
  border:1px solid rgba(255,255,255,0.15) !important; background:#2b2d30 !important;
  color:#f0f0f0 !important; cursor:pointer !important;
}
.dsh-agy-action-pill.is-remove-btn:hover:not(:disabled) {
  background:#3c3f41 !important; border-color:#1677ff !important; color:#ffffff !important;
}

/* Quick Setup Card (Plan C) */
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

/**
 * Formats relative countdown string in exact parity with antigravity_quota.mjs formatShortCountdown.
 */
function formatShortCountdown(isoString?: string): string {
  if (!isoString) return '-'
  const diff = new Date(isoString).getTime() - Date.now()
  if (diff <= 0) return '已刷新'
  const totalMinutes = Math.floor(diff / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const mins = totalMinutes % 60
  if (days > 0) {
    return hours > 0 ? `${days}d${hours}h` : `${days}d`
  }
  if (hours > 0) {
    return `${hours}h${mins}m`
  }
  return `${mins}m`
}

function getAccountQuotaMetrics(quota?: AccountQuotaSummary) {
  if (!quota?.ok || !quota.groups) return undefined
  const allBuckets = quota.groups.flatMap(g => g.buckets)
  
  // Strictly isolate Gemini core buckets (gemini-5h, gemini-weekly)
  // NEVER fall back to 3p (Claude/GPT) buckets which are unused and falsely show 100%!
  const geminiBuckets = allBuckets.filter(b => /^gemini[-_]/i.test(b.bucketId || ''))
  const b5h = geminiBuckets.find(b => b.window === '5h')
    ?? allBuckets.find(b => b.window === '5h' && !/^3p[-_]/i.test(b.bucketId || ''))
  const bWeekly = geminiBuckets.find(b => b.window === 'weekly')
    ?? allBuckets.find(b => b.window === 'weekly' && !/^3p[-_]/i.test(b.bucketId || ''))
  
  if (!b5h && !bWeekly) return undefined

  const f5h = b5h?.remainingFraction
  const fWeekly = bWeekly?.remainingFraction
  const p5h = f5h !== undefined ? Math.round(f5h * 100) : undefined
  const pWeekly = fWeekly !== undefined ? Math.round(fWeekly * 100) : undefined

  // Score represents the effective bottleneck (Math.min of 5h and weekly), identical to antigravity_quota.mjs
  const score = Math.min(
    f5h !== undefined ? f5h * 100 : 100,
    fWeekly !== undefined ? fWeekly * 100 : 100,
  )

  const is5hExhausted = f5h !== undefined ? f5h <= 0 : false
  const isWeeklyExhausted = fWeekly !== undefined ? fWeekly <= 0 : false
  const isExhausted = score <= 10 || ((b5h ? is5hExhausted : true) && (bWeekly ? isWeeklyExhausted : true))

  const reset5h = b5h?.resetTime ? formatShortCountdown(b5h.resetTime) : ''
  const resetWeekly = bWeekly?.resetTime ? formatShortCountdown(bWeekly.resetTime) : ''

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
  const url = method === 'GET' ? `${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}` : path
  const response = await fetch(url, {
    method,
    headers: { accept: 'application/json', ...body === undefined ? {} : { 'content-type': 'application/json' } },
    credentials: 'same-origin',
    cache: 'no-store',
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

  // Advanced settings state
  const [advancedEffort, setAdvancedEffort] = useState<'low' | 'medium' | 'high'>('medium')
  const [advancedContextWindow, setAdvancedContextWindow] = useState<number>(1_048_576)
  const [advancedStrategy, setAdvancedStrategy] = useState<'failover_429' | 'proactive_threshold' | 'round_robin' | 'manual'>('failover_429')
  const [advancedThreshold, setAdvancedThreshold] = useState<number>(20)
  const [savingAdvanced, setSavingAdvanced] = useState(false)

  // One-time dismissible banner state (persisted)
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(DISMISSED_BANNER_KEY) === 'true'
    }
    return false
  })

  // Web2API quick setup guide dismiss state
  const [guideDismissed, setGuideDismissed] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(DISMISSED_WEB2API_GUIDE_KEY) === 'true'
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
    setError(undefined)
    try {
      const res = await jsonRequest<{ ok: boolean, quotas: Record<string, AccountQuotaSummary> }>(QUOTAS_PATH)
      if (res?.quotas) {
        setQuotas(res.quotas)
        setToastMessage(t('quotas') + ' ' + (t('statusConnected') || 'refreshed'))
        setTimeout(() => setToastMessage(null), 2500)
      } else {
        setError('Quota response was empty')
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Failed to refresh quotas')
    } finally {
      setLoadingQuotas(false)
    }
  }, [t])

  const loadAdvanced = useCallback(async () => {
    try {
      const res = await jsonRequest<{ ok: boolean, settings: any }>(ADVANCED_PATH)
      if (res?.settings) {
        if (res.settings.defaultReasoningEffort) setAdvancedEffort(res.settings.defaultReasoningEffort)
        if (res.settings.modelContextWindow) setAdvancedContextWindow(Number(res.settings.modelContextWindow))
        if (res.settings.switchingStrategy) setAdvancedStrategy(res.settings.switchingStrategy)
        if (typeof res.settings.proactiveThreshold === 'number') setAdvancedThreshold(res.settings.proactiveThreshold)
      }
    } catch {}
  }, [])

  const saveAdvanced = async () => {
    setSavingAdvanced(true)
    setError(undefined)
    try {
      await jsonRequest(ADVANCED_PATH, 'POST', {
        defaultReasoningEffort: advancedEffort,
        modelContextWindow: advancedContextWindow,
        switchingStrategy: advancedStrategy,
        proactiveThreshold: advancedThreshold,
      })
      setToastMessage(t('advancedSaved'))
      setTimeout(() => setToastMessage(null), 3000)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Failed to save advanced settings')
    } finally {
      setSavingAdvanced(false)
    }
  }

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
    void loadAdvanced()
  }, [refresh, refreshQuotas, loadNetwork, loadWeb2Api, loadAdvanced])

  const dismissGuide = () => {
    setGuideDismissed(true)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DISMISSED_WEB2API_GUIDE_KEY, 'true')
    }
  }

  const restoreGuide = () => {
    setGuideDismissed(false)
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DISMISSED_WEB2API_GUIDE_KEY)
    }
  }

  const dismissBanner = () => {
    setBannerDismissed(true)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DISMISSED_BANNER_KEY, 'true')
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

      {/* Title Row with Active Account Info Cleanly Beside the Title */}
      <div className="dsh-agy-header">
        <div className="dsh-agy-title-row">
          <h2 id="antigravity-settings-title" className="dsh-agy-title">{t('title')}</h2>
          <div className="dsh-agy-header-active-badge" title={activeAccount ? activeAccount.email ?? activeAccount.id : t('signedOut')}>
            <span className={'dsh-agy-dot ' + (signing ? 'is-signing-in' : activeAccount?.ready ? 'is-signed-in' : 'is-error')} />
            <span>{signing ? t('signingIn') : activeAccount ? activeAccount.email ?? activeAccount.id : t('signedOut')}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="dsh-agy-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'accounts'}
            className={'dsh-agy-tab-btn ' + (activeTab === 'accounts' ? 'is-active' : '')}
            onClick={() => setActiveTab('accounts')}
          >
            <span>{t('tabAccounts')}</span>
            {accounts.length > 0 ? (
              <span style={{ fontSize: '11px', opacity: 0.85, background: 'rgba(255,255,255,0.25)', padding: '1px 6px', borderRadius: '10px' }}>
                {accounts.length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'advanced'}
            className={'dsh-agy-tab-btn ' + (activeTab === 'advanced' ? 'is-active' : '')}
            onClick={() => setActiveTab('advanced')}
          >
            <span>{t('tabAdvanced')}</span>
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

      {/* Dismissible Notice Banner (Hides automatically in Compact View) */}
      {!bannerDismissed && !compactView ? (
        <div className="dsh-agy-notice-banner">
          <p className="dsh-agy-body" style={{ margin: 0 }}>{t('tos')}</p>
          <button
            type="button"
            className="dsh-agy-notice-close"
            title={t('dismissNotice')}
            onClick={dismissBanner}
          >
            ×
          </button>
        </div>
      ) : null}

      {error ? <p className="dsh-agy-error">{error}</p> : null}

      {/* TAB 1: ACCOUNTS & QUOTA */}
      {activeTab === 'accounts' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Streamlined Hero Summary Bar */}
          <div className="dsh-agy-card" style={{ padding: '8px 12px' }}>
            <div className="dsh-agy-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={'dsh-agy-dot ' + (signing ? 'is-signing-in' : activeAccount?.ready ? 'is-signed-in' : 'is-error')} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{t('authStatus')}:</span>
                <span className={'dsh-agy-status-badge ' + (activeAccount?.ready ? 'is-success' : 'is-error')}>
                  {signing ? t('signingIn') : activeAccount ? (activeAccount.ready ? t('signedIn') : t('authorized')) : t('signedOut')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {signing ? (
                  <button type="button" className="dsh-agy-action-pill is-remove-btn" onClick={() => { void recover('cancel') }}>
                    {t('cancel')}
                  </button>
                ) : (
                  <button type="button" className="dsh-agy-btn dsh-agy-btn-primary" disabled={busy} onClick={() => { void signIn() }}>
                    {busy ? t('working') : accounts.length === 0 ? t('login') : t('addAccount')}
                  </button>
                )}
                {accounts.length > 0 ? (
                  <button type="button" className="dsh-agy-btn dsh-agy-btn-secondary" disabled={busy || loadingQuotas} onClick={() => { void refreshQuotas() }}>
                    {loadingQuotas ? '...' : t('refreshQuotas')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Accounts List & Filter Controls Card */}
          {accounts.length > 0 ? (
            <div className="dsh-agy-card">
              {/* Single-Line Minimal Toolbar */}
              <div className="dsh-agy-row" style={{ gap: '10px', alignItems: 'center' }}>
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  {/* Modern Segmented Sort Toggle */}
                  <div className="dsh-agy-segmented">
                    <button
                      type="button"
                      className={'dsh-agy-segmented-btn ' + (sortBy === 'default' ? 'is-active' : '')}
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      onClick={() => setSortBy('default')}
                      title={t('sortDefault')}
                    >
                      {t('sortDefaultShort')}
                    </button>
                    <button
                      type="button"
                      className={'dsh-agy-segmented-btn ' + (sortBy === 'quota' ? 'is-active' : '')}
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      onClick={() => setSortBy('quota')}
                      title={t('sortQuota')}
                    >
                      ⚡ {t('sortQuotaShort')}
                    </button>
                  </div>

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer', color: '#b0b4ba', userSelect: 'none' }}>
                    <input type="checkbox" checked={compactView} onChange={e => setCompactView(e.target.checked)} style={{ cursor: 'pointer' }} />
                    <span>{t('compactView')}</span>
                  </label>
                </div>
              </div>

              {/* Accounts Items List */}
              <div className={'dsh-agy-account-list ' + (compactView ? 'is-compact-mode' : '')}>
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
                    const score = metrics?.score !== undefined ? Math.round(metrics.score) : undefined

                    const title5h = p5h !== undefined
                      ? `5h limit: ${p5h}%${metrics?.reset5h ? ` (${t('quotaResetsIn')} ${metrics.reset5h})` : ''}`
                      : '5h limit: Quota not loaded'

                    const titleWeekly = pWeekly !== undefined
                      ? `Weekly limit: ${pWeekly}%${metrics?.resetWeekly ? ` (${t('quotaResetsIn')} ${metrics.resetWeekly})` : ''}`
                      : 'Weekly limit: Quota not loaded'

                    const titleOverall = score !== undefined
                      ? `Effective bottleneck: ${score}% · 5h: ${p5h}% · Weekly: ${pWeekly}%`
                      : ''

                    return (
                      <div
                        key={account.id}
                        className={'dsh-agy-account ' + (isActive ? 'is-active ' : '') + (compactView ? 'is-compact' : '')}
                        onClick={() => { if (!isActive && !switchingId) void switchAccount(account) }}
                      >
                        {/* Account Main Info */}
                        <div className="dsh-agy-account-main">
                          <input type="radio" checked={isActive} readOnly style={{ cursor: 'pointer', flexShrink: 0 }} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="dsh-agy-account-mail">{account.email ?? account.id}</span>
                              {isSwitching ? <span className="dsh-agy-status-badge is-switching">{t('working')}...</span> : null}
                              {account.limited ? <span className="dsh-agy-status-badge is-error">{t('accountLimited')}</span> : null}
                              {account.dead ? <span className="dsh-agy-status-badge is-error">{t('accountNeedsRelogin')}</span> : null}
                            </div>
                            {!compactView && account.projectId ? (
                              <span style={{ fontSize: '11px', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis' }}>{account.projectId}</span>
                            ) : null}
                          </div>
                        </div>

                        {/* Quota Indicators */}
                        <div className="dsh-agy-account-metrics" onClick={e => e.stopPropagation()} title={titleOverall}>
                          {/* 5h Quota Bar */}
                          {p5h !== undefined ? (
                            <div className="dsh-agy-capsule-bar" title={title5h}>
                              <div className="dsh-agy-capsule-main">
                                <span>5h {p5h}%</span>
                                <div className="dsh-agy-capsule-progress">
                                  <div
                                    className={'dsh-agy-capsule-fill ' + (p5h > 40 ? 'is-high' : p5h > 15 ? 'is-med' : 'is-low')}
                                    style={{ width: p5h + '%' }}
                                  />
                                </div>
                              </div>
                              <span className="dsh-agy-capsule-reset">
                                {metrics?.reset5h ? metrics.reset5h : t('quotaFullyAvailable')}
                              </span>
                            </div>
                          ) : null}

                          {/* Weekly Quota Bar */}
                          {pWeekly !== undefined ? (
                            <div className="dsh-agy-capsule-bar" title={titleWeekly}>
                              <div className="dsh-agy-capsule-main">
                                <span>{t('quotaWeeklyShort')} {pWeekly}%</span>
                                <div className="dsh-agy-capsule-progress">
                                  <div
                                    className={'dsh-agy-capsule-fill ' + (pWeekly > 40 ? 'is-high' : pWeekly > 15 ? 'is-med' : 'is-low')}
                                    style={{ width: pWeekly + '%' }}
                                  />
                                </div>
                              </div>
                              <span className="dsh-agy-capsule-reset">
                                {metrics?.resetWeekly ? metrics.resetWeekly : t('quotaFullyAvailable')}
                              </span>
                            </div>
                          ) : null}
                        </div>

                        {/* Rightmost Action Column: Active badge in line with Remove button! */}
                        <div className="dsh-agy-account-action" onClick={e => e.stopPropagation()}>
                          {isActive ? (
                            <span className="dsh-agy-action-pill is-active-badge">{t('activeBadge')}</span>
                          ) : (
                            <button
                              type="button"
                              className="dsh-agy-action-pill is-remove-btn"
                              disabled={busy || Boolean(switchingId)}
                              onClick={() => { void removeAccount(account.id) }}
                            >
                              {t('removeAccount')}
                            </button>
                          )}
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

      {/* TAB 2: ADVANCED CONFIGURATION */}
      {activeTab === 'advanced' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Card 1: Model Reasoning & Context Window */}
          <div className="dsh-agy-card">
            <div className="dsh-agy-row">
              <p className="dsh-agy-card-title">
                <span>🧠</span>
                <span>{t('modelTuningTitle')}</span>
              </p>
            </div>
            <p className="dsh-agy-body">{t('modelTuningDesc')}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '6px', fontWeight: 500, color: '#f0f0f0' }}>
                  {t('defaultReasoningEffort')}
                </label>
                <div className="dsh-agy-segmented" role="radiogroup">
                  <button
                    type="button"
                    className={'dsh-agy-segmented-btn ' + (advancedEffort === 'low' ? 'is-active' : '')}
                    onClick={() => setAdvancedEffort('low')}
                  >
                    🌱 {t('effortLow')}
                  </button>
                  <button
                    type="button"
                    className={'dsh-agy-segmented-btn ' + (advancedEffort === 'medium' ? 'is-active' : '')}
                    onClick={() => setAdvancedEffort('medium')}
                  >
                    ⚡ {t('effortMedium')}
                  </button>
                  <button
                    type="button"
                    className={'dsh-agy-segmented-btn ' + (advancedEffort === 'high' ? 'is-active' : '')}
                    onClick={() => setAdvancedEffort('high')}
                  >
                    🔥 {t('effortHigh')}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '6px', fontWeight: 500, color: '#f0f0f0' }}>
                  {t('modelContextWindow')}
                </label>
                <div className="dsh-agy-segmented" role="radiogroup">
                  <button
                    type="button"
                    className={'dsh-agy-segmented-btn ' + (advancedContextWindow === 131072 ? 'is-active' : '')}
                    onClick={() => setAdvancedContextWindow(131072)}
                  >
                    {t('contextWindow128K')}
                  </button>
                  <button
                    type="button"
                    className={'dsh-agy-segmented-btn ' + (advancedContextWindow === 262144 ? 'is-active' : '')}
                    onClick={() => setAdvancedContextWindow(262144)}
                  >
                    {t('contextWindow256K')}
                  </button>
                  <button
                    type="button"
                    className={'dsh-agy-segmented-btn ' + (advancedContextWindow === 524288 ? 'is-active' : '')}
                    onClick={() => setAdvancedContextWindow(524288)}
                  >
                    {t('contextWindow512K')}
                  </button>
                  <button
                    type="button"
                    className={'dsh-agy-segmented-btn ' + (advancedContextWindow === 1048576 ? 'is-active' : '')}
                    onClick={() => setAdvancedContextWindow(1048576)}
                  >
                    {t('contextWindow1M')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Account Switching Strategies */}
          <div className="dsh-agy-card">
            <div className="dsh-agy-row">
              <p className="dsh-agy-card-title">
                <span>🔄</span>
                <span>{t('switchingStrategyTitle')}</span>
              </p>
            </div>
            <p className="dsh-agy-body">{t('switchingStrategyDesc')}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <div
                className={'dsh-agy-radio-card ' + (advancedStrategy === 'failover_429' ? 'is-active' : '')}
                onClick={() => setAdvancedStrategy('failover_429')}
              >
                <div className="dsh-agy-custom-radio">
                  <div className="dsh-agy-custom-radio-dot" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0' }}>{t('strategyFailover')}</span>
                    <span className="dsh-agy-card-badge">Default</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#9a9ea5' }}>Switch to the account with highest quota only when 429 quota exhaustion occurs.</span>
                </div>
              </div>

              <div
                className={'dsh-agy-radio-card ' + (advancedStrategy === 'proactive_threshold' ? 'is-active' : '')}
                onClick={() => setAdvancedStrategy('proactive_threshold')}
              >
                <div className="dsh-agy-custom-radio">
                  <div className="dsh-agy-custom-radio-dot" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0' }}>{t('strategyProactive')}</span>
                  <span style={{ fontSize: '11px', color: '#9a9ea5' }}>{t('thresholdLabel', { threshold: advancedThreshold })}</span>
                  {advancedStrategy === 'proactive_threshold' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="range"
                        min="10"
                        max="40"
                        step="5"
                        value={advancedThreshold}
                        onChange={e => setAdvancedThreshold(Number(e.target.value))}
                        style={{ flex: '1 1 140px', cursor: 'pointer', accentColor: '#1677ff' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#1677ff', minWidth: '35px' }}>{advancedThreshold}%</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                className={'dsh-agy-radio-card ' + (advancedStrategy === 'round_robin' ? 'is-active' : '')}
                onClick={() => setAdvancedStrategy('round_robin')}
              >
                <div className="dsh-agy-custom-radio">
                  <div className="dsh-agy-custom-radio-dot" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0' }}>{t('strategyRoundRobin')}</span>
                  <span style={{ fontSize: '11px', color: '#9a9ea5' }}>Rotate through all available accounts per turn to balance rolling usage.</span>
                </div>
              </div>

              <div
                className={'dsh-agy-radio-card ' + (advancedStrategy === 'manual' ? 'is-active' : '')}
                onClick={() => setAdvancedStrategy('manual')}
              >
                <div className="dsh-agy-custom-radio">
                  <div className="dsh-agy-custom-radio-dot" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0' }}>{t('strategyManual')}</span>
                  <span style={{ fontSize: '11px', color: '#9a9ea5' }}>Never auto-switch accounts; stay strictly on the currently selected account.</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '8px' }}>
              <button
                type="button"
                className="dsh-agy-btn dsh-agy-btn-primary"
                disabled={savingAdvanced}
                onClick={() => { void saveAdvanced() }}
              >
                {savingAdvanced ? t('working') : t('saveAdvanced')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* TAB 3: WEB2API GATEWAY (PLAN C) */}
      {activeTab === 'web2api' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

      {/* TAB 4: NETWORK & PROXY */}
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
