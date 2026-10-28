import type { AntigravityKey } from '../locales.ts'

export type Network = { mode: 'auto' | 'direct' | 'proxy', url: string, effective: string }

export interface NetworkTabProps {
  t: (key: AntigravityKey, params?: Record<string, unknown>) => string
  network?: Network
  setNetwork: (network: Network) => void
  savingNetwork: boolean
  saveNetwork: () => void
  networkError?: boolean
  networkMessage: string
}

export function NetworkTab(props: NetworkTabProps) {
  const {
    t,
    network,
    setNetwork,
    savingNetwork,
    saveNetwork,
    networkMessage,
    networkError = false,
  } = props

  if (!network) return null

  return (
    <div className="dsh-agy-card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
        <label className="dsh-agy-field">
          <span className="dsh-agy-control-label">{t('network')}</span>
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
          <label className="dsh-agy-field">
            <span className="dsh-agy-control-label">
              {t('proxyUrl')}
            </span>
            <input
              type="text"
              className="dsh-agy-input"
              aria-label={t('proxyUrl')}
              placeholder="http://127.0.0.1:7890"
              value={network.url}
              disabled={savingNetwork}
              onChange={e => setNetwork({ ...network, url: e.target.value })}
            />
          </label>
        ) : null}

        <div className="dsh-agy-field dsh-agy-muted">
          <span>{t('effectiveNetwork')}</span>
          <code className="dsh-agy-proxy-route">
            {network.effective || 'direct'}
          </code>
        </div>

        <div className="dsh-agy-actions">
          <button
            type="button"
            className="dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact"
            disabled={savingNetwork}
            onClick={saveNetwork}
          >
            {savingNetwork ? t('working') : t('saveNetwork')}
          </button>

          {networkMessage ? (
            <span role={networkError ? 'alert' : 'status'} className={'dsh-agy-feedback ' + (networkError ? 'is-error' : 'is-success')}>
              {networkMessage}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
