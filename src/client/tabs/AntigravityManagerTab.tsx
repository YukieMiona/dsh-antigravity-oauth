import { useState } from 'react'
import type { AntigravityKey } from '../locales.ts'

export interface AntigravityManagerTabProps {
  t: (key: AntigravityKey, params?: Record<string, unknown>) => string
  initialBaseUrl?: string
  initialApiKey?: string
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:8045/v1'
const DEFAULT_ANTHROPIC_URL = 'http://127.0.0.1:8045'
const DEFAULT_WEB_URL = 'http://127.0.0.1:8045'
const DEFAULT_API_KEY = 'sk-547e3bdf50f24bae8a58348151df4e5f'
const DOCKER_CMD = 'docker run -d --name antigravity-manager -p 8045:8045 -e API_KEY=sk-547e3bdf50f24bae8a58348151df4e5f -e ABV_MAX_BODY_SIZE=104857600 -v ~/.antigravity_tools:/root/.antigravity_tools lbjlaq/antigravity-manager:latest'

const MANAGER_BASE_URL_KEY = 'dsh-antigravity-oauth.manager-base-url'
const MANAGER_API_KEY_KEY = 'dsh-antigravity-oauth.manager-api-key'

export function AntigravityManagerTab(props: AntigravityManagerTabProps) {
  const { t, initialBaseUrl, initialApiKey } = props

  const exportCmd = t('managerExportCmd') || "jq '.accounts | map({email, refresh_token: .refresh})' ~/.dsh/.dsh-antigravity-oauth.json > /tmp/accounts_for_manager.json"

  const [baseUrl, setBaseUrlState] = useState(() => {
    try { return localStorage.getItem(MANAGER_BASE_URL_KEY) || initialBaseUrl || DEFAULT_BASE_URL }
    catch { return initialBaseUrl || DEFAULT_BASE_URL }
  })
  const [apiKey, setApiKeyState] = useState(() => {
    try { return localStorage.getItem(MANAGER_API_KEY_KEY) || initialApiKey || DEFAULT_API_KEY }
    catch { return initialApiKey || DEFAULT_API_KEY }
  })
  const [isEditing, setIsEditing] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean, msg: string } | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const setBaseUrl = (val: string) => {
    setBaseUrlState(val)
    try { localStorage.setItem(MANAGER_BASE_URL_KEY, val) } catch {}
  }
  const setApiKey = (val: string) => {
    setApiKeyState(val)
    try { localStorage.setItem(MANAGER_API_KEY_KEY, val) } catch {}
  }
  const resetDefaults = () => {
    setBaseUrl(DEFAULT_BASE_URL)
    setApiKey(DEFAULT_API_KEY)
    setIsEditing(false)
  }

  const copyText = (text: string, key: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  const probeStatus = async () => {
    setDetecting(true)
    setFeedback(null)
    const start = Date.now()
    try {
      // 1. Direct browser probe (Antigravity-Manager has native CORS enabled)
      const testUrl = baseUrl.replace(/\/+$/, '') + '/models'
      const headers: Record<string, string> = { accept: 'application/json' }
      if (apiKey) headers.authorization = `Bearer ${apiKey}`
      const directRes = await fetch(testUrl, {
        headers,
        signal: AbortSignal.timeout(3500),
      }).catch(() => null)

      if (directRes && directRes.ok) {
        const latency = Date.now() - start
        const data: any = await directRes.json().catch(() => ({}))
        const modelsCount = Array.isArray(data?.data) ? data.data.length : 0
        setFeedback({
          ok: true,
          msg: t('managerConnected', { count: modelsCount, latency }),
        })
        return
      }

      // 2. Fallback to DSH plugin backend relay probe
      const res = await fetch('/plugins/dsh-antigravity-oauth/manager/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baseUrl, apiKey }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.ok) {
        setFeedback({
          ok: true,
          msg: t('managerConnected', { count: data.modelsCount ?? 0, latency: data.latency ?? 0 }),
        })
      } else {
        setFeedback({
          ok: false,
          msg: t('managerDisconnected') + (data?.error ? ` (${data.error})` : ''),
        })
      }
    } catch (err: unknown) {
      setFeedback({
        ok: false,
        msg: t('managerDisconnected') + ` (${String(err)})`,
      })
    } finally {
      setDetecting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Overview & Status Probe Card */}
      <div className="dsh-agy-card">
        <div className="dsh-agy-row" style={{ alignItems: 'flex-start' }}>
          <div>
            <span className="dsh-agy-card-title">{t('managerTitle')}</span>
            <p className="dsh-agy-card-desc" style={{ marginTop: '2px' }}>{t('managerDesc')}</p>
          </div>
          <a
            href={DEFAULT_WEB_URL}
            target="_blank"
            rel="noreferrer"
            className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
            style={{ textDecoration: 'none' }}
          >
            {t('managerOpenWeb')}
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
          <button
            type="button"
            className="dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact"
            disabled={detecting}
            onClick={() => { void probeStatus() }}
          >
            {detecting ? t('managerDetecting') : t('managerDetect')}
          </button>
        </div>

        {feedback ? (
          <div
            style={{
              marginTop: '10px',
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              lineHeight: 1.4,
              backgroundColor: feedback.ok ? 'rgba(77, 107, 254, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              color: feedback.ok ? 'var(--dsh-color-primary, #4D6BFE)' : 'var(--dsh-color-error, #EF4444)',
              border: `1px solid ${feedback.ok ? 'rgba(77, 107, 254, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
            }}
          >
            {feedback.msg}
          </div>
        ) : null}
      </div>

      {/* Endpoints & Credentials Card */}
      <div className="dsh-agy-card">
        <div className="dsh-agy-row">
          <span className="dsh-agy-card-title">{t('managerEndpoints')}</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? t('managerDoneEditing') : t('managerEdit')}
            </button>
            {isEditing ? (
              <button
                type="button"
                className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
                onClick={resetDefaults}
              >
                {t('managerResetDefault')}
              </button>
            ) : null}
          </div>
        </div>

        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <label className="dsh-agy-field" style={{ margin: 0 }}>
              <span className="dsh-agy-control-label">{t('managerOpenAiBase')}</span>
              <input
                type="text"
                className="dsh-agy-input"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder={DEFAULT_BASE_URL}
              />
            </label>
            <label className="dsh-agy-field" style={{ margin: 0 }}>
              <span className="dsh-agy-control-label">{t('managerApiKeyLabel')}</span>
              <input
                type="text"
                className="dsh-agy-input"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={DEFAULT_API_KEY}
              />
            </label>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--dsh-text-muted, #888)' }}>{t('managerOpenAiBase')}</span>
              <div className="dsh-agy-code-terminal">
                <code>{baseUrl}</code>
                <button
                  type="button"
                  className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
                  onClick={() => copyText(baseUrl, 'openai')}
                >
                  {copiedKey === 'openai' ? t('copied') : t('copyCommand')}
                </button>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--dsh-text-muted, #888)' }}>{t('managerAnthropicBase')}</span>
              <div className="dsh-agy-code-terminal">
                <code>{DEFAULT_ANTHROPIC_URL}</code>
                <button
                  type="button"
                  className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
                  onClick={() => copyText(DEFAULT_ANTHROPIC_URL, 'anthropic')}
                >
                  {copiedKey === 'anthropic' ? t('copied') : t('copyCommand')}
                </button>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--dsh-text-muted, #888)' }}>{t('managerApiKeyLabel')}</span>
              <div className="dsh-agy-code-terminal">
                <code>{apiKey}</code>
                <button
                  type="button"
                  className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
                  onClick={() => copyText(apiKey, 'apikey')}
                >
                  {copiedKey === 'apikey' ? t('copied') : t('copyCommand')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* One-Click Account Export Card */}
      <div className="dsh-agy-card">
        <span className="dsh-agy-card-title">{t('managerExportTitle')}</span>
        <p className="dsh-agy-card-desc" style={{ marginTop: '2px' }}>{t('managerExportDesc')}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          <div className="dsh-agy-code-terminal">
            <code style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exportCmd}</code>
            <button
              type="button"
              className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
              style={{ flexShrink: 0 }}
              onClick={() => copyText(exportCmd, 'export')}
            >
              {copiedKey === 'export' ? t('copied') : t('copyCommand')}
            </button>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--dsh-text-muted, #888)' }}>{t('managerExportNote')}</span>
        </div>
      </div>

      {/* Docker Container One-Liner Card */}
      <div className="dsh-agy-card">
        <span className="dsh-agy-card-title">{t('managerDockerCmd')}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
          <div className="dsh-agy-code-terminal">
            <code style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{DOCKER_CMD}</code>
            <button
              type="button"
              className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
              style={{ flexShrink: 0 }}
              onClick={() => copyText(DOCKER_CMD, 'docker')}
            >
              {copiedKey === 'docker' ? t('copied') : t('copyCommand')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
