import type { AntigravityKey } from '../locales.ts'

export interface Web2ApiTabProps {
  t: (key: AntigravityKey, params?: Record<string, unknown>) => string
  guideDismissed: boolean
  dismissGuide: () => void
  restoreGuide: () => void
  dockerCmd: string
  copiedDocker: boolean
  copyDockerCommand: () => void
  web2apiDetecting: boolean
  detectLocalGateway: () => void
  web2apiEnabled: boolean
  setWeb2apiEnabled: (enabled: boolean) => void
  web2apiSaving: boolean
  web2apiBaseUrl: string
  setWeb2apiBaseUrl: (url: string) => void
  web2apiApiKey: string
  setWeb2apiApiKey: (key: string) => void
  web2apiImageTool: boolean
  setWeb2apiImageTool: (val: boolean) => void
  saveWeb2Api: () => void
  web2apiTesting: boolean
  testWeb2Api: () => void
  web2apiFeedback: { ok: boolean, msg: string } | null
}

export function Web2ApiTab(props: Web2ApiTabProps) {
  const {
    t,
    guideDismissed,
    dismissGuide,
    restoreGuide,
    dockerCmd,
    copiedDocker,
    copyDockerCommand,
    web2apiDetecting,
    detectLocalGateway,
    web2apiEnabled,
    setWeb2apiEnabled,
    web2apiSaving,
    web2apiBaseUrl,
    setWeb2apiBaseUrl,
    web2apiApiKey,
    setWeb2apiApiKey,
    web2apiImageTool,
    setWeb2apiImageTool,
    saveWeb2Api,
    web2apiTesting,
    testWeb2Api,
    web2apiFeedback,
  } = props

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Quick Setup Snippet */}
      {!guideDismissed ? (
        <div className="dsh-agy-card">
          <div className="dsh-agy-row">
            <span className="dsh-agy-card-title">
              {t('quickSetupTitle')}
            </span>
            <button
              type="button"
              className="dsh-agy-notice-close"
              aria-label={t('hideGuide')}
              onClick={dismissGuide}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
            <div className="dsh-agy-code-terminal">
              <code style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dockerCmd}</code>
              <button
                type="button"
                className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
                style={{ flexShrink: 0 }}
                onClick={copyDockerCommand}
              >
                {copiedDocker ? t('copied') : t('copyCommand')}
              </button>
            </div>

            <div>
              <button
                type="button"
                className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
                disabled={web2apiSaving || web2apiTesting || web2apiDetecting}
                onClick={detectLocalGateway}
              >
                {web2apiDetecting ? t('detecting') : t('detectService')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="dsh-agy-actions">
          <button
            type="button"
            className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
            onClick={restoreGuide}
          >
            {t('showGuide')}
          </button>
        </div>
      )}

      {/* Gateway Configuration Card */}
      <div className="dsh-agy-card">
        <div className="dsh-agy-row">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={web2apiEnabled}
              disabled={web2apiSaving || web2apiTesting || web2apiDetecting}
              onChange={e => setWeb2apiEnabled(e.target.checked)}
            />
            <span>{t('web2apiEnable')}</span>
          </label>
        </div>

        {web2apiEnabled ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="dsh-agy-chip"
                disabled={web2apiSaving || web2apiTesting || web2apiDetecting}
                onClick={() => setWeb2apiBaseUrl('http://127.0.0.1:18088/v1')}
              >
                {t('presetLocal')}
              </button>
              <button
                type="button"
                className="dsh-agy-chip"
                disabled={web2apiSaving || web2apiTesting || web2apiDetecting}
                onClick={() => setWeb2apiBaseUrl('http://localhost:18088/v1')}
              >
                {t('presetDocker')}
              </button>
            </div>

            <label className="dsh-agy-field">
              <span className="dsh-agy-control-label">
                {t('web2apiBaseUrl')}
              </span>
              <input
                type="text"
                className="dsh-agy-input"
                placeholder="http://127.0.0.1:18088/v1"
                value={web2apiBaseUrl}
                disabled={web2apiSaving || web2apiTesting || web2apiDetecting}
                onChange={e => setWeb2apiBaseUrl(e.target.value)}
              />
            </label>

            <label className="dsh-agy-field">
              <span className="dsh-agy-control-label">
                {t('web2apiApiKey')}
              </span>
              <input
                type="password"
                className="dsh-agy-input"
                placeholder="sk-..."
                value={web2apiApiKey}
                disabled={web2apiSaving || web2apiTesting || web2apiDetecting}
                onChange={e => setWeb2apiApiKey(e.target.value)}
              />
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={web2apiImageTool}
                disabled={web2apiSaving || web2apiTesting || web2apiDetecting}
                onChange={e => setWeb2apiImageTool(e.target.checked)}
              />
              <span>{t('web2apiImageTool')}</span>
            </label>
          </div>
        ) : null}

        {/* Action Row & Feedback - Visible whether enabled or disabled */}
        <div className="dsh-agy-actions">
          <button
            type="button"
            className="dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact"
            disabled={web2apiSaving || web2apiTesting || web2apiDetecting}
            onClick={saveWeb2Api}
          >
            {web2apiSaving ? t('working') : t('web2apiSave')}
          </button>

          {web2apiEnabled ? (
            <button
              type="button"
              className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
              disabled={web2apiSaving || web2apiTesting || web2apiDetecting}
              onClick={testWeb2Api}
            >
              {web2apiTesting ? t('web2apiTesting') : t('web2apiTest')}
            </button>
          ) : null}

          {web2apiFeedback ? (
            <span
              role={web2apiFeedback.ok ? "status" : "alert"}
              className={'dsh-agy-feedback ' + (web2apiFeedback.ok ? 'is-success' : 'is-error')}
            >
              {web2apiFeedback.msg}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
