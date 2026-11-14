import { useEffect, useRef, useState } from 'react'
import type { AntigravityKey } from '../locales.ts'
import type { ManagerSettingsView } from '../../manager/store.ts'
import type { BridgeProbeResult } from '../../manager/probe.ts'
import { REASONING_EFFORTS, routeChatModel } from '../../models.ts'

export type BridgePatch = { enabled?: boolean, baseUrl?: string, apiKey?: string }

export interface ManagerTabProps {
  t: (key: AntigravityKey, params?: Record<string, unknown>) => string
  settings?: ManagerSettingsView
  /** Public model ids enabled on the Advanced tab; used to warn about models the gateway lacks. */
  enabledModels: readonly string[]
  save: (patch: BridgePatch) => Promise<ManagerSettingsView>
  test: (target: { baseUrl: string, apiKey?: string }) => Promise<BridgeProbeResult>
}

type Feedback = { ok: boolean, msg: string } | null

function HealthTile({ name, up, detail }: { name: string, up?: boolean, detail: string }) {
  const dot = up === undefined ? '' : up ? 'is-signed-in' : 'is-error'
  return (
    <div className="dsh-agy-health-tile">
      <span className="dsh-agy-health-name"><span className={'dsh-agy-dot ' + dot} />{name}</span>
      <span className="dsh-agy-health-detail">{detail}</span>
    </div>
  )
}

export function ManagerTab({ t, settings, enabledModels, save, test }: ManagerTabProps) {
  const [baseUrl, setBaseUrl] = useState(settings?.baseUrl ?? '')
  const [apiKey, setApiKey] = useState('')
  const [reveal, setReveal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [probe, setProbe] = useState<BridgeProbeResult>()
  const [feedback, setFeedback] = useState<Feedback>(null)
  const probedOnce = useRef(false)

  useEffect(() => {
    if (settings !== undefined) setBaseUrl(settings.baseUrl)
  }, [settings?.baseUrl])

  const runTest = async (quiet = false): Promise<void> => {
    setTesting(true)
    if (!quiet) setFeedback(null)
    try {
      const result = await test({ baseUrl: baseUrl.trim(), ...apiKey.trim() ? { apiKey: apiKey.trim() } : {} })
      setProbe(result)
      if (!quiet) {
        setFeedback(result.ok
          ? { ok: true, msg: t('bridgeConnected', { latency: result.latencyMs, count: result.models.length }) }
          : { ok: false, msg: t('bridgeFailed', { error: result.error ?? t('unknownError') }) })
      }
    } catch (error) {
      if (!quiet) setFeedback({ ok: false, msg: t('bridgeFailed', { error: error instanceof Error ? error.message : t('unknownError') }) })
    } finally {
      setTesting(false)
    }
  }

  // A loopback health check is cheap, so show live status as soon as the tab opens.
  useEffect(() => {
    if (settings === undefined || probedOnce.current) return
    probedOnce.current = true
    void runTest(true)
  }, [settings])

  const persist = async (patch: BridgePatch): Promise<void> => {
    setSaving(true)
    setFeedback(null)
    try {
      await save(patch)
      setApiKey('')
      setFeedback({ ok: true, msg: t('bridgeSaved') })
    } catch (error) {
      setFeedback({ ok: false, msg: error instanceof Error ? error.message : t('saveFailed') })
    } finally {
      setSaving(false)
    }
  }

  if (settings === undefined) return null
  const busy = saving || testing
  const enabled = settings.enabled
  // The bridge sends the effort-specific wire id, so every effort's id must exist on the gateway.
  const offered = new Set(probe?.models ?? [])
  const missing = probe?.ok
    ? enabledModels.filter(id => REASONING_EFFORTS.some(effort => !offered.has(routeChatModel(id, effort))))
    : []

  return (
    <div className="dsh-agy-stack">
      <div className="dsh-agy-card">
        <div className="dsh-agy-status-strip">
          <div className="dsh-agy-status-main">
            <span className={'dsh-agy-dot ' + (enabled ? (probe?.ok === false ? 'is-error' : 'is-signed-in') : '')} />
            <span className="dsh-agy-status-label">{enabled ? t('bridgeStatusOn') : t('bridgeStatusOff')}</span>
            {enabled ? <span className="dsh-agy-status-meta dsh-agy-mono">{settings.baseUrl}</span> : null}
          </div>
          <label className="dsh-agy-switch">
            <input
              type="checkbox"
              checked={enabled}
              disabled={busy}
              onChange={e => { void persist({ enabled: e.target.checked }) }}
            />
            <span>{t('bridgeEnable')}</span>
          </label>
        </div>
        <p className="dsh-agy-hint">{t('bridgeEnableHint')}</p>
        <div className="dsh-agy-health">
          <HealthTile
            name={t('bridgeGateway')}
            up={probe === undefined ? undefined : probe.gatewayUp}
            detail={probe === undefined
              ? (testing ? t('bridgeTesting') : t('bridgeNotTested'))
              : probe.ok
                ? `${t('bridgeUp')} · ${probe.latencyMs} ms · ${probe.models.length} models`
                : probe.gatewayUp ? (probe.error ?? t('bridgeDown')) : t('bridgeDown')}
          />
          <HealthTile
            name={t('bridgeCore')}
            up={probe?.coreUp}
            detail={probe === undefined ? t('bridgeNotTested') : `${probe.coreUp ? t('bridgeUp') : t('bridgeDown')} · 127.0.0.1:18046`}
          />
        </div>
        {missing.length > 0 ? (
          <p className="dsh-agy-callout is-warn" role="status">{t('bridgeModelsMissing', { models: missing.join(', ') })}</p>
        ) : null}
      </div>

      <div className="dsh-agy-card">
        <div className="dsh-agy-section-text">
          <p className="dsh-agy-section-title">{t('bridgeTitle')}</p>
          <p className="dsh-agy-section-desc">{t('bridgeHelp')}</p>
        </div>

        <label className="dsh-agy-field">
          <span className="dsh-agy-control-label">{t('bridgeBaseUrl')}</span>
          <input
            type="text"
            className="dsh-agy-input dsh-agy-mono"
            placeholder="http://127.0.0.1:8045/v1"
            value={baseUrl}
            disabled={busy}
            spellCheck={false}
            onChange={e => setBaseUrl(e.target.value)}
          />
        </label>

        <div className="dsh-agy-field">
          <label className="dsh-agy-field">
            <span className="dsh-agy-control-label">{t('bridgeApiKey')}</span>
            <span className="dsh-agy-input-row">
              <input
                type={reveal ? 'text' : 'password'}
                className="dsh-agy-input dsh-agy-mono"
                placeholder={settings.hasApiKey ? '••••••••' : 'sk-…'}
                value={apiKey}
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
                onChange={e => setApiKey(e.target.value)}
              />
              <button
                type="button"
                className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
                aria-pressed={reveal}
                disabled={apiKey.length === 0}
                onClick={() => setReveal(!reveal)}
              >
                {reveal ? t('bridgeHide') : t('bridgeReveal')}
              </button>
            </span>
          </label>
          <span className="dsh-agy-hint">
            {settings.hasApiKey ? t('bridgeApiKeySaved', { hint: settings.apiKeyHint }) : t('bridgeApiKeyNone')}
            {settings.hasApiKey ? (
              <>
                {' '}
                <button type="button" className="dsh-agy-link dsh-agy-link-btn" disabled={busy} onClick={() => { void persist({ apiKey: '' }) }}>
                  {t('bridgeClearKey')}
                </button>
              </>
            ) : null}
          </span>
        </div>

        <div className="dsh-agy-actions">
          <button
            type="button"
            className="dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact"
            disabled={busy || baseUrl.trim().length === 0}
            onClick={() => { void persist({ baseUrl: baseUrl.trim(), ...apiKey.trim() ? { apiKey: apiKey.trim() } : {} }) }}
          >
            {saving ? t('working') : t('bridgeSave')}
          </button>
          <button
            type="button"
            className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
            disabled={busy || baseUrl.trim().length === 0}
            onClick={() => { void runTest() }}
          >
            {testing ? t('bridgeTesting') : t('bridgeTest')}
          </button>
          {probe?.ok ? (
            <span className="dsh-agy-pills">
              <span className={'dsh-agy-pill ' + (probe.latencyMs < 300 ? 'is-success' : 'is-warn')}>{probe.latencyMs} ms</span>
              <span className="dsh-agy-pill">{probe.models.length} models</span>
            </span>
          ) : null}
        </div>
        {feedback ? (
          <span role={feedback.ok ? 'status' : 'alert'} className={'dsh-agy-feedback ' + (feedback.ok ? 'is-success' : 'is-error')}>
            {feedback.msg}
          </span>
        ) : null}

        <p className="dsh-agy-callout">{t('bridgeCallout')}</p>
      </div>
    </div>
  )
}
