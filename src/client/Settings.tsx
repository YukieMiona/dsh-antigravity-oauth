import { useCallback, useEffect, useState } from 'react'
import type { AntigravityKey } from './locales.ts'
import type { AccountQuotaSummary, AntigravityStatus } from '../types.ts'

const STATUS_PATH = '/plugins/dsh-antigravity-oauth/auth/status'
const LOGIN_PATH = '/plugins/dsh-antigravity-oauth/auth/login'
const COMPLETE_PATH = '/plugins/dsh-antigravity-oauth/auth/complete'
const LOGOUT_PATH = '/plugins/dsh-antigravity-oauth/auth/logout'
const SWITCH_PATH = '/plugins/dsh-antigravity-oauth/auth/accounts/switch'
const REMOVE_PATH = '/plugins/dsh-antigravity-oauth/auth/accounts/remove'
const QUOTAS_PATH = '/plugins/dsh-antigravity-oauth/auth/accounts/quotas'
const POLL_INTERVAL_MS = 1_000
const STYLE_ID = 'dsh-antigravity-oauth-settings-theme'

const NETWORK_PATH = '/plugins/dsh-antigravity-oauth/network'
type Network = { mode: 'auto' | 'direct' | 'proxy', url: string, effective: string }

export interface AntigravitySettingsInjected {
  t: (key: AntigravityKey, params?: Record<string, unknown>) => string
}

export type AntigravitySettingsProps = Partial<AntigravitySettingsInjected>

const SETTINGS_CSS = `
.dsh-agy-page { display:flex; flex-direction:column; gap:16px; max-width:640px; color:var(--dsw-alias-label-primary); }
.dsh-agy-title { margin:0; font-size:20px; line-height:28px; font-weight:600; color:var(--dsw-alias-label-primary); }
.dsh-agy-body { margin:0; font-size:13px; line-height:20px; color:var(--dsw-alias-label-secondary); }
.dsh-agy-error { margin:0; font-size:13px; line-height:20px; color:var(--dsw-alias-state-error-primary); }
.dsh-agy-card {
  display:flex; flex-direction:column; gap:8px; padding:14px 16px;
  border:1px solid var(--dsw-alias-border-l2); border-radius:12px;
  background:var(--dsw-alias-bg-module-platform);
}
.dsh-agy-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; }
.dsh-agy-name { margin:0; font-size:15px; font-weight:600; color:var(--dsw-alias-label-primary); }
.dsh-agy-status { display:flex; align-items:center; flex-wrap:wrap; gap:6px; font-size:13px; color:var(--dsw-alias-label-secondary); }
.dsh-agy-dot { width:8px; height:8px; border-radius:50%; flex:0 0 auto; background:var(--dsw-alias-label-dimmed, #9aa0a6); }
.dsh-agy-dot.is-signed-in { background:var(--dsw-alias-state-success-primary, #22a06b); }
.dsh-agy-dot.is-error { background:var(--dsw-alias-state-error-primary, #d92d20); }
.dsh-agy-dot.is-signing-in { background:var(--dsw-alias-brand-primary, #1677ff); }
.dsh-agy-btn {
  box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center;
  min-height:32px; padding:4px 14px; border-radius:16px; font:inherit; font-size:13px; line-height:20px; cursor:pointer;
}
.dsh-agy-btn:disabled { opacity:0.55; cursor:not-allowed; }
.dsh-agy-btn-secondary {
  border:1px solid var(--dsw-alias-border-l2);
  background:transparent;
  color:var(--dsw-alias-label-primary);
}
.dsh-agy-btn-primary {
  border:none;
  background:var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary));
  color:var(--dsw-alias-label-primary-foreground, #fff);
}
.dsh-agy-link { color:var(--dsw-alias-brand-primary); word-break:break-all; }
.dsh-agy-form { display:flex; flex-direction:column; gap:8px; }
.dsh-agy-input {
  box-sizing:border-box; width:100%; min-height:36px; padding:7px 10px;
  border:1px solid var(--dsw-alias-border-l2); border-radius:8px;
  background:var(--dsw-alias-bg-page-primary, transparent);
  color:var(--dsw-alias-label-primary); font:inherit; font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.dsh-agy-actions { display:flex; justify-content:flex-end; }
.dsh-agy-summary-bar {
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  padding:6px 12px; border-radius:8px; font-size:12px;
  background:var(--dsw-alias-bg-page-primary, rgba(0,0,0,0.02));
  border:1px solid var(--dsw-alias-border-l2);
  color:var(--dsw-alias-label-secondary);
}
.dsh-agy-summary-badge {
  display:inline-flex; align-items:center; gap:4px;
}
.dsh-agy-summary-badge.is-available {
  color:var(--dsw-alias-state-success-primary, #22a06b); font-weight:500;
}
.dsh-agy-summary-badge.is-exhausted {
  color:var(--dsw-alias-state-error-primary, #d92d20); font-weight:500;
}
.dsh-agy-toolbar {
  display:flex; flex-direction:column; gap:8px;
}
.dsh-agy-search-box {
  position:relative; display:flex; align-items:center; width:100%;
}
.dsh-agy-search-input {
  box-sizing:border-box; width:100%; min-height:32px; padding:5px 28px 5px 10px;
  border:1px solid var(--dsw-alias-border-l2); border-radius:8px;
  background:var(--dsw-alias-bg-page-primary, transparent);
  color:var(--dsw-alias-label-primary); font:inherit; font-size:12px;
}
.dsh-agy-search-clear {
  position:absolute; right:6px; background:none; border:none;
  cursor:pointer; color:var(--dsw-alias-label-secondary); font-size:14px;
  padding:2px 6px; line-height:1;
}
.dsh-agy-controls {
  display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; font-size:12px;
  color:var(--dsw-alias-label-secondary);
}
.dsh-agy-filters {
  display:flex; align-items:center; gap:12px; flex-wrap:wrap;
}
.dsh-agy-check-label {
  display:inline-flex; align-items:center; gap:5px; cursor:pointer; user-select:none;
}
.dsh-agy-check-label input[type="checkbox"] {
  accent-color:var(--dsw-alias-brand-primary, #1677ff); cursor:pointer; margin:0;
}
.dsh-agy-sort {
  display:inline-flex; align-items:center; gap:6px; margin-left:auto;
}
.dsh-agy-select {
  box-sizing:border-box; min-height:26px; padding:2px 8px; border-radius:6px;
  border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-page-primary, transparent);
  color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; cursor:pointer;
}
.dsh-agy-account-list {
  max-height:480px; overflow-y:auto; padding-right:4px;
  display:flex; flex-direction:column; gap:8px;
}
.dsh-agy-empty-tip {
  padding:16px; text-align:center; font-size:13px;
  color:var(--dsw-alias-label-secondary);
  border:1px dashed var(--dsw-alias-border-l2); border-radius:8px;
}
.dsh-agy-account {
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  padding:8px 10px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px;
}
.dsh-agy-account.is-active {
  border-color:var(--dsw-alias-brand-primary, #1677ff);
  background:var(--dsw-alias-brand-primary-faint, rgba(22, 119, 255, 0.04));
}
.dsh-agy-account-main { display:flex; align-items:center; gap:8px; flex:1 1 auto; min-width:0; cursor:pointer; }
.dsh-agy-account-main input[type="radio"] { accent-color:var(--dsw-alias-brand-primary, #1677ff); }
.dsh-agy-account-mail { font-size:13px; color:var(--dsw-alias-label-primary); word-break:break-all; }
.dsh-agy-badges { display:inline-flex; gap:6px; flex-wrap:wrap; align-items:center; }
.dsh-agy-badge {
  display:inline-flex; align-items:center; padding:1px 8px; border-radius:10px;
  font-size:12px; line-height:18px;
  border:1px solid var(--dsw-alias-border-l2); color:var(--dsw-alias-label-secondary);
}
.dsh-agy-badge.is-error {
  border-color:var(--dsw-alias-state-error-primary, #d92d20);
  color:var(--dsw-alias-state-error-primary, #d92d20);
}
.dsh-agy-badge.is-active {
  border-color:var(--dsw-alias-brand-primary, #1677ff);
  color:var(--dsw-alias-brand-primary, #1677ff);
  font-weight:600;
}
.dsh-agy-quota-capsule {
  display:inline-flex; align-items:center; gap:4px;
  padding:1px 8px; border-radius:10px; font-size:11px; line-height:18px;
  border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-page-primary, rgba(0,0,0,0.02));
  font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.dsh-agy-quota-capsule.is-high {
  border-color:rgba(34,160,107,0.3); color:var(--dsw-alias-state-success-primary, #22a06b);
}
.dsh-agy-quota-capsule.is-med {
  border-color:rgba(245,158,11,0.3); color:#d97706;
}
.dsh-agy-quota-capsule.is-low {
  border-color:rgba(217,45,32,0.3); color:var(--dsw-alias-state-error-primary, #d92d20);
}
.dsh-agy-remove { margin-left:auto; }
.dsh-agy-quota-box {
  width:100%; display:flex; flex-direction:column; gap:6px;
  padding:8px 10px; margin-top:4px; border-radius:6px;
  background:var(--dsw-alias-bg-page-primary, rgba(0,0,0,0.03));
  border:1px dashed var(--dsw-alias-border-l2);
}
.dsh-agy-quota-grid { display:flex; flex-wrap:wrap; gap:14px; align-items:center; }
.dsh-agy-quota-item { display:inline-flex; align-items:center; gap:6px; font-size:12px; }
.dsh-agy-quota-bar {
  width:64px; height:6px; border-radius:3px;
  background:var(--dsw-alias-border-l2, #e5e7eb); overflow:hidden;
}
.dsh-agy-quota-fill { height:100%; border-radius:3px; }
.dsh-agy-quota-fill.is-high { background:var(--dsw-alias-state-success-primary, #22a06b); }
.dsh-agy-quota-fill.is-med { background:#f59e0b; }
.dsh-agy-quota-fill.is-low { background:var(--dsw-alias-state-error-primary, #d92d20); }
`

function formatReset(iso?: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime() - Date.now()
  if (t <= 0) return ''
  const h = Math.floor(t / 3600000)
  const m = Math.floor((t % 3600000) / 60000)
  if (h >= 24) {
    const d = Math.floor(h / 24)
    return `${d}d`
  }
  return `${h}h${m}m`
}

function getAccountQuotaMetrics(quota?: AccountQuotaSummary) {
  if (!quota?.ok || !quota.groups) return undefined
  const buckets = quota.groups.flatMap(g => g.buckets).filter(b => b.window === '5h' || b.window === 'weekly')
  const b5h = buckets.find(b => b.window === '5h')
  const bWeekly = buckets.find(b => b.window === 'weekly')
  if (!b5h && !bWeekly) return undefined

  const f5h = b5h?.remainingFraction
  const fWeekly = bWeekly?.remainingFraction
  const p5h = f5h !== undefined ? Math.round(f5h * 1000) / 10 : undefined
  const pWeekly = fWeekly !== undefined ? Math.round(fWeekly * 1000) / 10 : undefined

  const is5hExhausted = f5h !== undefined ? f5h <= 0 : false
  const isWeeklyExhausted = fWeekly !== undefined ? fWeekly <= 0 : false
  const isExhausted = (b5h ? is5hExhausted : true) && (bWeekly ? isWeeklyExhausted : true) && (!!b5h || !!bWeekly)

  const score = Math.min(
    f5h !== undefined ? f5h * 100 : 100,
    fWeekly !== undefined ? fWeekly * 100 : 100,
  )

  const reset5h = b5h ? formatReset(b5h.resetTime) : ''
  const resetWeekly = bWeekly ? formatReset(bWeekly.resetTime) : ''

  return {
    b5h,
    bWeekly,
    p5h,
    pWeekly,
    isExhausted,
    score,
    reset5h,
    resetWeekly,
  }
}

function ensureThemeStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = SETTINGS_CSS
  document.head.appendChild(style)
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
      : `HTTP ${response.status}`
    throw new Error(message)
  }
  return value as T
}

export function AntigravitySettings({ t }: AntigravitySettingsProps) {
  if (t === undefined) throw new Error('Antigravity settings requires its translation function')
  const [status, setStatus] = useState<AntigravityStatus | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [network, setNetwork] = useState<Network>()
  const [networkMessage, setNetworkMessage] = useState('')
  const [quotas, setQuotas] = useState<Record<string, AccountQuotaSummary>>({})
  const [loadingQuotas, setLoadingQuotas] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [hideExhausted, setHideExhausted] = useState(false)
  const [compactView, setCompactView] = useState(false)
  const [sortBy, setSortBy] = useState<'default' | 'quota'>('default')

  useEffect(() => { ensureThemeStyles() }, [])

  const refreshQuotas = useCallback(async () => {
    setLoadingQuotas(true)
    try {
      const res = await jsonRequest<{ ok: boolean, quotas: Record<string, AccountQuotaSummary> }>(QUOTAS_PATH)
      if (res?.quotas) setQuotas(res.quotas)
    } catch {
      /* ignore quota fetch errors */
    } finally {
      setLoadingQuotas(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      setStatus(await jsonRequest<AntigravityStatus>(STATUS_PATH))
      setError(undefined)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    }
  }, [t])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    void refreshQuotas()
  }, [refreshQuotas])
  useEffect(() => {
    void jsonRequest<Network>(NETWORK_PATH).then(setNetwork).catch(err => setError(String(err)))
  }, [])
  const signing = status?.status === 'signing-in'
  useEffect(() => {
    if (!signing) return
    const timer = window.setInterval(() => { void refresh() }, POLL_INTERVAL_MS)
    return () => { window.clearInterval(timer) }
  }, [refresh, signing])

  const signIn = async (): Promise<void> => {
    const popup = window.open('about:blank', '_blank')
    if (popup !== null) popup.opener = null
    setBusy(true)
    try {
      const challenge = await jsonRequest<{ url: string }>(LOGIN_PATH, 'POST', {})
      if (popup !== null && challenge.url !== undefined) popup.location.replace(challenge.url)
      if (popup === null && challenge.url !== undefined) window.open(challenge.url, '_blank', 'noopener,noreferrer')
      if (popup !== null && challenge.url === undefined) popup.close()
      await refresh()
    } catch (caught: unknown) {
      popup?.close()
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  const complete = async (): Promise<void> => {
    const value = draft.trim()
    if (value.length === 0) return
    setBusy(true)
    try {
      await jsonRequest<{ ok: true }>(COMPLETE_PATH, 'POST', { url: value })
      setDraft('')
      await refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  const removeAccount = async (id: string): Promise<void> => {
    setBusy(true)
    try {
      const result = await jsonRequest<{ ok: true, account: AntigravityStatus }>(REMOVE_PATH, 'POST', { id })
      setStatus(result.account)
      await refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  const switchAccount = async (id: string): Promise<void> => {
    setBusy(true)
    try {
      const result = await jsonRequest<{ ok: true, account: AntigravityStatus }>(SWITCH_PATH, 'POST', { id })
      setStatus(result.account)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  const signOutActive = async (): Promise<void> => {
    setBusy(true)
    try {
      await jsonRequest<{ ok: true }>(LOGOUT_PATH, 'POST', {})
      await refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  const recover = async (action: 'cancel' | 'retry'): Promise<void> => {
    setBusy(true)
    try {
      await jsonRequest(`/plugins/dsh-antigravity-oauth/auth/${action}`, 'POST', {})
      setDraft('')
      await refresh()
    } catch (err) { setError(String(err)) } finally { setBusy(false) }
  }

  const saveNetwork = async (): Promise<void> => {
    if (!network) return
    setBusy(true)
    try {
      setNetwork(await jsonRequest<Network>(NETWORK_PATH, 'POST', { mode: network.mode, url: network.url }))
      setNetworkMessage(t('networkSaved'))
    } catch (err) { setError(String(err)) } finally { setBusy(false) }
  }

  const accounts = status?.accounts ?? []
  const activeId = status?.status === 'signed-in' ? status.activeId : undefined
  const activeAccount = accounts.find(account => account.id === activeId)
  const loginError = status?.status === 'error' ? status.message : undefined
  const serviceMessage = status?.status === 'signed-in' ? status.message : undefined

  let availableCount = 0
  let exhaustedCount = 0
  for (const account of accounts) {
    const isDead = account.dead
    const metrics = getAccountQuotaMetrics(quotas[account.id])
    const isEx = isDead || (metrics ? metrics.isExhausted : false)
    if (isEx) {
      exhaustedCount++
    } else {
      availableCount++
    }
  }

  const filteredAccounts = accounts.filter((account) => {
    if (hideExhausted && account.id !== activeId) {
      const isDead = account.dead
      const metrics = getAccountQuotaMetrics(quotas[account.id])
      if (isDead || metrics?.isExhausted) return false
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      const email = (account.email ?? '').toLowerCase()
      const proj = (account.projectId ?? '').toLowerCase()
      const id = account.id.toLowerCase()
      if (!email.includes(q) && !proj.includes(q) && !id.includes(q)) return false
    }
    return true
  })

  const visibleAccounts = [...filteredAccounts].sort((a, b) => {
    if (a.id === activeId) return -1
    if (b.id === activeId) return 1
    if (sortBy === 'quota') {
      const scoreA = getAccountQuotaMetrics(quotas[a.id])?.score ?? -1
      const scoreB = getAccountQuotaMetrics(quotas[b.id])?.score ?? -1
      return scoreB - scoreA
    }
    return 0
  })

  const label = status === undefined
    ? t('loadingAccount')
    : status.status === 'signing-in'
      ? t('signingIn')
      : status.status === 'error'
        ? t('requestFailed')
        : status.status === 'signed-out'
          ? t('signedOut')
          : activeAccount?.ready === false
            ? t('authorized')
            : t('signedIn')
  const dotClass = status?.status === 'signed-in'
    ? 'dsh-agy-dot is-signed-in'
    : status?.status === 'error'
      ? 'dsh-agy-dot is-error'
      : status?.status === 'signing-in'
        ? 'dsh-agy-dot is-signing-in'
        : 'dsh-agy-dot'

  return (
    <section className="dsh-agy-page" aria-labelledby="antigravity-settings-title">
      <h2 id="antigravity-settings-title" className="dsh-agy-title">{t('title')}</h2>
      <p className="dsh-agy-body">{t('tos')}</p>
      {error !== undefined ? <p className="dsh-agy-error">{error}</p> : null}
      {network && <div className="dsh-agy-card">
        <p className="dsh-agy-name">{t('network')}</p>
        <p className="dsh-agy-body">{t('networkHelp')}</p>
        <label>{t('network')} <select aria-label={t('network')} value={network.mode} disabled={busy}
          onChange={e => setNetwork({ ...network, mode: e.target.value as Network['mode'] })}>
          <option value="auto">{t('networkAuto')}</option>
          <option value="direct">{t('networkDirect')}</option>
          <option value="proxy">{t('networkProxy')}</option>
        </select></label>
        {network.mode === 'proxy' && <input className="dsh-agy-input" aria-label={t('proxyUrl')}
          placeholder="http://127.0.0.1:45678" value={network.url} disabled={busy}
          onChange={e => setNetwork({ ...network, url: e.target.value })} />}
        <p className="dsh-agy-body">{t('effectiveNetwork')} {network.effective}</p>
        <button className="dsh-agy-btn dsh-agy-btn-secondary" disabled={busy} onClick={() => { void saveNetwork() }}>{t('saveNetwork')}</button>
        {networkMessage && <p role="status">{networkMessage}</p>}
      </div>}
      <article className="dsh-agy-card">
        <div className="dsh-agy-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p className="dsh-agy-name">{t('accounts')}</p>
            {accounts.length > 0 ? (
              <button
                type="button"
                className="dsh-agy-btn dsh-agy-btn-secondary"
                style={{ padding: '2px 8px', fontSize: '11px', minHeight: '22px' }}
                disabled={busy || loadingQuotas}
                onClick={() => { void refreshQuotas() }}
              >
                {loadingQuotas ? t('working') : t('refreshQuotas')}
              </button>
            ) : null}
          </div>
          {signing ? (
            <button type="button" className="dsh-agy-btn dsh-agy-btn-secondary" onClick={() => { void recover('cancel') }}>{t('cancel')}</button>
          ) : (
            <button type="button" className="dsh-agy-btn dsh-agy-btn-primary" disabled={busy}
              onClick={() => { void signIn() }}>
              {busy ? t('working') : status?.status === 'error' ? t('loginAgain') : accounts.length === 0 ? t('login') : t('addAccount')}
            </button>
          )}
        </div>
        <div className="dsh-agy-status" role="status">
          <span aria-hidden="true" className={dotClass} />
          <span>{label}</span>
        </div>
        {loginError !== undefined ? <p className="dsh-agy-error">{loginError}</p> : null}
        {serviceMessage !== undefined ? <p className="dsh-agy-error">{serviceMessage}</p> : null}
        {accounts.length > 0 ? <p className="dsh-agy-body">{t('quotaHint')}</p> : null}

        {accounts.length > 0 ? (
          <>
            <div className="dsh-agy-summary-bar">
              <span className="dsh-agy-summary-badge">
                {t('totalLabel')} <strong>{accounts.length}</strong>
              </span>
              <span>·</span>
              <span className="dsh-agy-summary-badge is-available">
                <strong>{availableCount}</strong> {t('availableLabel')}
              </span>
              {exhaustedCount > 0 ? (
                <>
                  <span>·</span>
                  <span className="dsh-agy-summary-badge is-exhausted">
                    <strong>{exhaustedCount}</strong> {t('exhaustedLabel')}
                  </span>
                </>
              ) : null}
            </div>

            <div className="dsh-agy-toolbar">
              <div className="dsh-agy-search-box">
                <input
                  type="text"
                  className="dsh-agy-search-input"
                  placeholder={t('searchAccountsPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="dsh-agy-search-clear"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery('')}
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <div className="dsh-agy-controls">
                <div className="dsh-agy-filters">
                  <label className="dsh-agy-check-label">
                    <input
                      type="checkbox"
                      checked={hideExhausted}
                      onChange={(e) => setHideExhausted(e.target.checked)}
                    />
                    <span>{t('hideExhausted')}</span>
                  </label>
                  <label className="dsh-agy-check-label">
                    <input
                      type="checkbox"
                      checked={compactView}
                      onChange={(e) => setCompactView(e.target.checked)}
                    />
                    <span>{t('compactView')}</span>
                  </label>
                </div>
                <div className="dsh-agy-sort">
                  <span>{t('sortBy')}:</span>
                  <select
                    className="dsh-agy-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'default' | 'quota')}
                  >
                    <option value="default">{t('sortDefault')}</option>
                    <option value="quota">{t('sortQuota')}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="dsh-agy-account-list">
              {visibleAccounts.length === 0 ? (
                <div className="dsh-agy-empty-tip">{t('noMatchingAccounts')}</div>
              ) : (
                visibleAccounts.map((account) => {
                  const isActive = account.id === activeId
                  const metrics = getAccountQuotaMetrics(quotas[account.id])
                  const score = metrics?.score ?? 0
                  const capsuleClass = score >= 50 ? 'is-high' : score >= 20 ? 'is-med' : 'is-low'

                  return (
                    <div className={`dsh-agy-account${isActive ? ' is-active' : ''}`} key={account.id}>
                      <label className="dsh-agy-account-main">
                        <input
                          type="radio"
                          name="dsh-agy-active-account"
                          aria-label={t('switchAccount')}
                          checked={isActive}
                          disabled={busy || signing}
                          onChange={() => { void switchAccount(account.id) }}
                        />
                        <span className="dsh-agy-account-mail">{account.email ?? t('unknownAccount')}</span>
                        <span className="dsh-agy-badges">
                          {isActive ? <span className="dsh-agy-badge is-active">{t('activeBadge')}</span> : null}
                          {account.dead ? <span className="dsh-agy-badge is-error">{t('accountNeedsRelogin')}</span> : null}
                          {account.limited ? <span className="dsh-agy-badge">{t('accountLimited')}</span> : null}
                          {!account.ready && !account.dead ? <span className="dsh-agy-badge">{t('accountNeedsEligibility')}</span> : null}
                          {compactView && metrics ? (
                            <span
                              className={`dsh-agy-quota-capsule ${capsuleClass}`}
                              title={`${metrics.b5h ? `5h: ${metrics.p5h}% ${metrics.reset5h ? `(${metrics.reset5h})` : ''}` : ''}${metrics.bWeekly ? ` | ${t('quotaWeeklyShort')}: ${metrics.pWeekly}% ${metrics.resetWeekly ? `(${metrics.resetWeekly})` : ''}` : ''}`}
                            >
                              {metrics.p5h !== undefined ? `5h: ${metrics.p5h}%` : ''}
                              {metrics.p5h !== undefined && metrics.pWeekly !== undefined ? ' | ' : ''}
                              {metrics.pWeekly !== undefined ? `${t('quotaWeeklyShort')}: ${metrics.pWeekly}%` : ''}
                            </span>
                          ) : null}
                        </span>
                      </label>
                      {account.projectId !== undefined ? (
                        <span className="dsh-agy-body">{t('project')} {account.projectId}</span>
                      ) : null}
                      <button
                        type="button"
                        className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-remove"
                        disabled={busy || signing}
                        onClick={() => {
                          void (account.id === activeId ? signOutActive() : removeAccount(account.id))
                        }}
                      >{t('removeAccount')}</button>
                      {!compactView && quotas[account.id]?.ok && quotas[account.id]?.groups ? (
                        <div className="dsh-agy-quota-box">
                          <div className="dsh-agy-quota-grid">
                            {quotas[account.id].groups!
                              .flatMap(g => g.buckets)
                              .filter(b => b.window === '5h' || b.window === 'weekly')
                              .map(b => {
                                const pct = Math.round(b.remainingFraction * 100)
                                const fillClass = pct >= 50 ? 'is-high' : pct >= 20 ? 'is-med' : 'is-low'
                                const label = b.window === '5h' ? t('quota5h') : t('quotaWeekly')
                                const reset = formatReset(b.resetTime)
                                return (
                                  <div key={b.bucketId} className="dsh-agy-quota-item" title={b.description || `${label}: ${pct}%`}>
                                    <span>{label}</span>
                                    <div className="dsh-agy-quota-bar">
                                      <div className={`dsh-agy-quota-fill ${fillClass}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span style={{ fontWeight: 600 }}>{pct}%</span>
                                    {reset ? <span style={{ opacity: 0.65 }}>({reset})</span> : null}
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </>
        ) : null}

        {signing && status?.status === 'signing-in' && status.url !== undefined
          ? (
              <p className="dsh-agy-body">
                {t('openUrl')}
                {' '}
                <a href={status.url} target="_blank" rel="noreferrer" className="dsh-agy-link">{t('reopen')}</a>
              </p>
            )
          : null}
        {signing
          ? (
              <form
                className="dsh-agy-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void complete()
                }}
              >
                <p className="dsh-agy-body">{t('completeHelp')}</p>
                <input
                  type="text"
                  className="dsh-agy-input"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t('completePlaceholder')}
                  value={draft}
                  disabled={busy}
                  onChange={(event) => { setDraft(event.target.value) }}
                />
                <div className="dsh-agy-actions">
                  <button type="submit" className="dsh-agy-btn dsh-agy-btn-primary" disabled={busy || draft.trim().length === 0}>
                    {busy ? t('working') : t('complete')}
                  </button>
                </div>
              </form>
            )
          : null}
        {activeAccount !== undefined && !activeAccount.ready
          ? (
              <button type="button" className="dsh-agy-btn dsh-agy-btn-primary" disabled={busy}
                onClick={() => { void recover('retry') }}>{busy ? t('working') : t('retryEligibility')}</button>
            )
          : null}
      </article>
    </section>
  )
}
