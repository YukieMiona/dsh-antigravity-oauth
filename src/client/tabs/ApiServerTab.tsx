import { useState } from 'react'
import type { AntigravityKey } from '../locales.ts'
import type { ApiServerSettings, ApiServerStatus } from '../../api-server/types.ts'

export interface ApiServerTabProps {
  t: (key: AntigravityKey, params?: Record<string, unknown>) => string
  settings: ApiServerSettings
  status: ApiServerStatus
  saving: boolean
  saveSettings: (settings: Partial<ApiServerSettings>) => Promise<void>
  regenerateKey: () => void
}

export function ApiServerTab(props: ApiServerTabProps) {
  const {
    t,
    settings,
    status,
    saving,
    saveSettings,
    regenerateKey,
  } = props

  const [enabled, setEnabled] = useState(settings.enabled)
  const [host, setHost] = useState(settings.host)
  const [port, setPort] = useState(settings.port)
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [hourlyLimit, setHourlyLimit] = useState(settings.hourlyLimit ?? 0)
  const [dailyLimit, setDailyLimit] = useState(settings.dailyLimit ?? 0)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedCurl, setCopiedCurl] = useState(false)
  const [revealKey, setRevealKey] = useState(false)

  const effectiveHost = status.running ? status.host : host
  const effectivePort = status.running ? status.port : port
  const baseUrl = `http://${effectiveHost === '0.0.0.0' ? '127.0.0.1' : effectiveHost}:${effectivePort}/v1`

  const curlFor = (key: string): string => `curl -X POST ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{"model":"gemini-3.8-flash","messages":[{"role":"user","content":"Hello!"}]}'`
  const curlExample = curlFor(apiKey)
  const maskedKey = apiKey.length > 10 ? `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}` : '…'

  const handleSave = async (overrides?: Partial<ApiServerSettings>) => {
    await saveSettings({
      enabled: overrides?.enabled !== undefined ? overrides.enabled : enabled,
      host: overrides?.host !== undefined ? overrides.host : host,
      port: overrides?.port !== undefined ? overrides.port : port,
      apiKey: overrides?.apiKey !== undefined ? overrides.apiKey : apiKey,
      hourlyLimit: overrides?.hourlyLimit !== undefined ? overrides.hourlyLimit : hourlyLimit,
      dailyLimit: overrides?.dailyLimit !== undefined ? overrides.dailyLimit : dailyLimit,
    })
  }

  const copyText = (text: string, setter: (val: boolean) => void) => {
    void navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  return (
    <div className="dsh-agy-stack">
      {/* Status Card */}
      <div className="dsh-agy-card">
        <div className="dsh-agy-status-strip">
          <div className="dsh-agy-status-main">
            <span className={'dsh-agy-dot ' + (status.running ? 'is-signed-in' : status.error ? 'is-error' : '')} />
            <span className="dsh-agy-status-label">
              {status.running ? t('apiServerRunning') : t('apiServerStopped')}
            </span>
            {status.running ? (
              <span className="dsh-agy-status-meta dsh-agy-mono">{t('apiServerRunningAt', { address: `${status.host}:${status.port}` })}</span>
            ) : null}
          </div>
          <button
            type="button"
            className={'dsh-agy-btn ' + (enabled ? 'dsh-agy-btn-secondary' : 'dsh-agy-btn-primary') + ' dsh-agy-btn-compact'}
            disabled={saving}
            onClick={() => {
              const next = !enabled
              setEnabled(next)
              void handleSave({ enabled: next })
            }}
          >
            {saving ? t('working') : enabled ? t('apiServerDisable') : t('apiServerEnable')}
          </button>
        </div>
        <p className="dsh-agy-hint">{t('apiServerDesc')}</p>
        {status.running && status.requestsLastDay !== undefined ? (
          <p className="dsh-agy-hint">{t('apiServerUsage', {
            hour: status.requestsLastHour ?? 0,
            day: status.requestsLastDay,
            hourLimit: settings.hourlyLimit > 0 ? ` / ${settings.hourlyLimit}` : '',
            dayLimit: settings.dailyLimit > 0 ? ` / ${settings.dailyLimit}` : '',
          })}</p>
        ) : null}
        {status.error ? <p className="dsh-agy-error">{status.error}</p> : null}
      </div>

      {/* Connection & Credentials */}
      <div className="dsh-agy-card">
        <div className="dsh-agy-field">
          <span className="dsh-agy-control-label">{t('apiServerBaseUrl')}</span>
          <div className="dsh-agy-code-terminal">
            <code>{baseUrl}</code>
            <button
              type="button"
              className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
              onClick={() => copyText(baseUrl, setCopiedUrl)}
            >
              {copiedUrl ? t('copied') : t('copyCommand')}
            </button>
          </div>
        </div>

        <label className="dsh-agy-field">
          <span className="dsh-agy-control-label">{t('apiServerKey')}</span>
          <span className="dsh-agy-input-row">
            <input
              type={revealKey ? 'text' : 'password'}
              className="dsh-agy-input dsh-agy-mono"
              value={apiKey}
              disabled={saving}
              autoComplete="off"
              spellCheck={false}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-agy-..."
            />
            <button
              type="button"
              className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
              aria-pressed={revealKey}
              onClick={() => setRevealKey(!revealKey)}
            >
              {revealKey ? t('bridgeHide') : t('bridgeReveal')}
            </button>
            <button
              type="button"
              className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
              onClick={() => copyText(apiKey, setCopiedKey)}
            >
              {copiedKey ? t('copied') : t('copyCommand')}
            </button>
            <button
              type="button"
              className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
              disabled={saving}
              onClick={() => { regenerateKey() }}
            >
              {t('apiServerRegenerateKey')}
            </button>
          </span>
        </label>

        <div className="dsh-agy-field-grid">
          <label className="dsh-agy-field">
            <span className="dsh-agy-control-label">{t('apiServerHost')}</span>
            <input
              type="text"
              className="dsh-agy-input dsh-agy-mono"
              list="dsh-agy-api-hosts"
              value={host}
              disabled={saving}
              spellCheck={false}
              onChange={e => setHost(e.target.value.trim())}
            />
            <datalist id="dsh-agy-api-hosts">
              <option value="127.0.0.1">Localhost only</option>
              <option value="172.17.0.1">Docker containers (docker0)</option>
              <option value="0.0.0.0">All interfaces (public if not firewalled)</option>
            </datalist>
          </label>

          <label className="dsh-agy-field">
            <span className="dsh-agy-control-label">{t('apiServerPort')}</span>
            <input
              type="number"
              className="dsh-agy-input dsh-agy-mono"
              value={port}
              disabled={saving}
              min={1024}
              max={65535}
              onChange={e => setPort(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="dsh-agy-field-grid">
          <label className="dsh-agy-field">
            <span className="dsh-agy-control-label">{t('apiServerHourlyLimit')}</span>
            <input
              type="number"
              className="dsh-agy-input dsh-agy-mono"
              value={hourlyLimit}
              disabled={saving}
              min={0}
              onChange={e => setHourlyLimit(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            />
          </label>
          <label className="dsh-agy-field">
            <span className="dsh-agy-control-label">{t('apiServerDailyLimit')}</span>
            <input
              type="number"
              className="dsh-agy-input dsh-agy-mono"
              value={dailyLimit}
              disabled={saving}
              min={0}
              onChange={e => setDailyLimit(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            />
          </label>
        </div>
        <p className="dsh-agy-hint">{t('apiServerLimitHint')}</p>

        <div className="dsh-agy-actions">
          <button
            type="button"
            className="dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact"
            disabled={saving}
            onClick={() => { void handleSave() }}
          >
            {saving ? t('working') : t('saveSettings')}
          </button>
        </div>
      </div>

      {/* Curl snippet */}
      <div className="dsh-agy-card">
        <div className="dsh-agy-section-head">
          <p className="dsh-agy-section-title">{t('apiServerQuickTest')}</p>
          <button
            type="button"
            className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
            onClick={() => copyText(curlExample, setCopiedCurl)}
          >
            {copiedCurl ? t('copied') : t('copyCommand')}
          </button>
        </div>
        <pre className="dsh-agy-pre">{revealKey ? curlExample : curlFor(maskedKey)}</pre>
      </div>
    </div>
  )
}
