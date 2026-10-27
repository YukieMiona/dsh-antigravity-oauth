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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {!guideDismissed ? (
        <div className="dsh-agy-guide-card">
          <div className="dsh-agy-guide-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🚀</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{t('quickSetupTitle')}</span>
              <span className="dsh-agy-status-badge is-success">Docker / Binary Ready</span>
            </div>
            <button
              type="button"
              className="dsh-agy-notice-close"
              title={t('hideGuide')}
              onClick={dismissGuide}
            >
              ×
            </button>
          </div>
          <p className="dsh-agy-body" style={{ color: '#b0b4ba' }}>{t('quickSetupDesc')}</p>

          <div className="dsh-agy-step">
            <div className="dsh-agy-step-num">1</div>
            <div className="dsh-agy-step-content">
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#f0f0f0' }}>{t('step1Title')}</span>
              <span className="dsh-agy-body" style={{ fontSize: '11px' }}>{t('step1Desc')}</span>
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
                  onClick={detectLocalGateway}
                >
                  {web2apiDetecting ? t('detecting') : t('detectService')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="dsh-agy-row" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>🚀</span>
            <span className="dsh-agy-body" style={{ fontSize: '12px', color: '#c0c4cc' }}>{t('quickSetupTitle')}</span>
          </div>
          <button
            type="button"
            className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
            style={{ padding: '2px 10px', fontSize: '11px' }}
            onClick={restoreGuide}
          >
            {t('showGuide')}
          </button>
        </div>
      )}

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

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
              <button
                type="button"
                className="dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact"
                disabled={web2apiSaving}
                onClick={saveWeb2Api}
              >
                {web2apiSaving ? t('working') : t('web2apiSave')}
              </button>
              <button
                type="button"
                className="dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact"
                disabled={web2apiSaving || web2apiTesting}
                onClick={testWeb2Api}
              >
                {web2apiTesting ? t('web2apiTesting') : t('web2apiTest')}
              </button>
            </div>

            {web2apiFeedback ? (
              <p
                role="status"
                className={'dsh-agy-status-badge ' + (web2apiFeedback.ok ? 'is-success' : 'is-error')}
                style={{ width: 'fit-content' }}
              >
                {web2apiFeedback.msg}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
