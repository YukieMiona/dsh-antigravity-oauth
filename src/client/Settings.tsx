import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const DOCKER_CMD = 'docker run -d --name gemini-web2api -p 18088:18088 zexadev/gemini-web2api-go:latest'
const DISMISSED_BANNER_KEY = 'dsh-antigravity-oauth.dismissed-banner'
const DISMISSED_WEB2API_GUIDE_KEY = 'dsh-antigravity-oauth.dismissed-web2api-guide'

type ActiveTab = 'accounts' | 'advanced' | 'web2api' | 'network'

export interface AntigravitySettingsInjected {
  t: (key: AntigravityKey, params?: Record<string, unknown>) => string
}

export type AntigravitySettingsProps = Partial<AntigravitySettingsInjected>

import { AccountsTab } from './tabs/AccountsTab.tsx'
import { AdvancedTab } from './tabs/AdvancedTab.tsx'
import { Web2ApiTab } from './tabs/Web2ApiTab.tsx'
import { NetworkTab, type Network } from './tabs/NetworkTab.tsx'
import { ensureThemeStyles } from './theme.ts'
import { evaluateQuotaMetrics as getAccountQuotaMetrics } from '../quota-core.ts'

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
  const accountAction = useRef(false)
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
  const [networkError, setNetworkError] = useState(false)
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

  const restoreBanner = () => {
    setBannerDismissed(false)
    if (typeof localStorage !== 'undefined') localStorage.removeItem(DISMISSED_BANNER_KEY)
  }

  const saveNetwork = async () => {
    if (!network) return
    setSavingNetwork(true)
    setNetworkMessage('')
    setNetworkError(false)
    try {
      const saved = await jsonRequest<Network>(NETWORK_PATH, 'POST', network)
      setNetwork(saved)
      setNetworkMessage(t('networkSaved'))
    } catch (e: unknown) {
      setNetworkError(true)
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
    if (busy || switchingId || accountAction.current) return
    accountAction.current = true
    setBusy(true)
    try {
      const challenge = await jsonRequest<{ url: string }>(LOGIN_PATH, 'POST')
      if (typeof window !== 'undefined') window.open(challenge.url, '_blank', 'noopener,noreferrer')
      void refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      accountAction.current = false
      setBusy(false)
    }
  }

  const complete = async () => {
    if (draft.trim().length === 0 || busy || switchingId || accountAction.current) return
    accountAction.current = true
    setBusy(true)
    try {
      await jsonRequest(COMPLETE_PATH, 'POST', { url: draft.trim() })
      setDraft('')
      void refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      accountAction.current = false
      setBusy(false)
    }
  }

  // Account switch with verified server return + non-intrusive floating toast
  const switchAccount = async (targetAccount: AccountSummary) => {
    if (busy || switchingId || accountAction.current) return
    accountAction.current = true
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
      await refresh()
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      accountAction.current = false
      setSwitchingId(null)
    }
  }

  const removeAccount = async (id: string) => {
    if (busy || switchingId || accountAction.current) return
    accountAction.current = true
    setBusy(true)
    try {
      await jsonRequest(REMOVE_PATH, 'POST', { id })
      void refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      accountAction.current = false
      setBusy(false)
    }
  }

  const recover = async (action: 'cancel' | 'retry') => {
    if (busy || switchingId || accountAction.current) return
    accountAction.current = true
    setBusy(true)
    try {
      await jsonRequest('/plugins/dsh-antigravity-oauth/auth/' + action, 'POST')
      setDraft('')
      void refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      accountAction.current = false
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

      {/* Notice visibility is independent of density. */}
      {!bannerDismissed ? (
        <div className="dsh-agy-notice-banner">
          <p className="dsh-agy-body" style={{ margin: 0 }}>{t('tos')}</p>
          <button
            type="button"
            className="dsh-agy-notice-close"
            aria-label={t('dismissNotice')}
            title={t('dismissNotice')}
            onClick={dismissBanner}
          >
            ×
          </button>
        </div>
      ) : (
        <div className="dsh-agy-actions">
          <button type="button" className="dsh-agy-btn dsh-agy-btn-secondary" onClick={restoreBanner}>{t('restoreNotice')}</button>
        </div>
      )}

      {error ? <p className="dsh-agy-error" role="alert">{error}</p> : null}

      {/* TAB 1: ACCOUNTS & QUOTA */}
      {activeTab === 'accounts' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Streamlined Summary Bar */}
          <div className="dsh-agy-card" style={{ padding: '8px 12px' }}>
            <div className="dsh-agy-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={'dsh-agy-dot ' + (signing ? 'is-signing-in' : activeAccount?.ready ? 'is-signed-in' : 'is-error')} />
                <span style={{ fontSize: '12px', fontWeight: 500 }}>
                  {signing ? t('signingIn') : activeAccount ? (activeAccount.ready ? t('signedIn') : t('authorized')) : t('signedOut')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {signing ? (
                  <button type="button" className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact" disabled={busy || Boolean(switchingId)} onClick={() => { void recover('cancel') }}>
                    {t('cancel')}
                  </button>
                ) : (
                  <button type="button" className="dsh-agy-btn dsh-agy-btn-primary" disabled={busy || Boolean(switchingId)} onClick={() => { void signIn() }}>
                    {busy ? t('working') : accounts.length === 0 ? t('login') : t('addAccount')}
                  </button>
                )}
                {accounts.length > 0 ? (
                  <button type="button" className="dsh-agy-btn dsh-agy-btn-secondary" disabled={busy || Boolean(switchingId) || loadingQuotas} onClick={() => { void refreshQuotas() }}>
                    {loadingQuotas ? '...' : t('refreshQuotas')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <AccountsTab
            t={t}
            language={t('quotaLanguage') === 'zh' ? 'zh' : 'en'}
            accounts={accounts}
            activeAccountId={activeAccountId}
            activeAccount={activeAccount}
            switchingId={switchingId}
            busy={busy}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            sortBy={sortBy}
            setSortBy={setSortBy}
            compactView={compactView}
            setCompactView={setCompactView}
            quotas={quotas}
            filteredAccounts={filteredAccounts}
            switchAccount={switchAccount}
            removeAccount={removeAccount}
            recover={recover}
          />

          {signing && status?.url ? (
            <div className="dsh-agy-card">
              <p className="dsh-agy-body">
                {t('openUrl')} <a href={status.url} target="_blank" rel="noreferrer" className="dsh-agy-link">{t('reopen')}</a>
              </p>
              <form onSubmit={e => { e.preventDefault(); void complete() }} style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <input
                  type="text"
                  className="dsh-agy-input"
                  aria-label={t('completePlaceholder')}
                  placeholder={t('completePlaceholder')}
                  value={draft}
                  disabled={busy || Boolean(switchingId)}
                  onChange={e => setDraft(e.target.value)}
                />
                <button type="submit" className="dsh-agy-btn dsh-agy-btn-primary" disabled={busy || Boolean(switchingId) || draft.trim().length === 0}>
                  {busy ? t('working') : t('complete')}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* TAB 2: ADVANCED CONFIGURATION */}
      {activeTab === 'advanced' ? (
        <AdvancedTab
          t={t}
          advancedEffort={advancedEffort}
          setAdvancedEffort={setAdvancedEffort}
          advancedContextWindow={advancedContextWindow}
          setAdvancedContextWindow={setAdvancedContextWindow}
          advancedStrategy={advancedStrategy}
          setAdvancedStrategy={setAdvancedStrategy}
          advancedThreshold={advancedThreshold}
          setAdvancedThreshold={setAdvancedThreshold}
          savingAdvanced={savingAdvanced}
          saveAdvanced={() => { void saveAdvanced() }}
        />
      ) : null}

      {/* TAB 3: WEB2API GATEWAY (PLAN C) */}
      {activeTab === 'web2api' ? (
        <Web2ApiTab
          t={t}
          guideDismissed={guideDismissed}
          dismissGuide={dismissGuide}
          restoreGuide={restoreGuide}
          dockerCmd={DOCKER_CMD}
          copiedDocker={copiedDocker}
          copyDockerCommand={copyDockerCommand}
          web2apiDetecting={web2apiDetecting}
          detectLocalGateway={() => { void detectLocalGateway() }}
          web2apiEnabled={web2apiEnabled}
          setWeb2apiEnabled={setWeb2apiEnabled}
          web2apiSaving={web2apiSaving}
          web2apiBaseUrl={web2apiBaseUrl}
          setWeb2apiBaseUrl={setWeb2apiBaseUrl}
          web2apiApiKey={web2apiApiKey}
          setWeb2apiApiKey={setWeb2apiApiKey}
          web2apiImageTool={web2apiImageTool}
          setWeb2apiImageTool={setWeb2apiImageTool}
          saveWeb2Api={() => { void saveWeb2Api() }}
          web2apiTesting={web2apiTesting}
          testWeb2Api={() => { void testWeb2Api() }}
          web2apiFeedback={web2apiFeedback}
        />
      ) : null}

      {/* TAB 4: NETWORK & PROXY */}
      {activeTab === 'network' ? (
        <NetworkTab
          t={t}
          network={network}
          setNetwork={setNetwork}
          savingNetwork={savingNetwork}
          saveNetwork={() => { void saveNetwork() }}
          networkMessage={networkMessage}
          networkError={networkError}
        />
      ) : null}
    </section>
  )
}