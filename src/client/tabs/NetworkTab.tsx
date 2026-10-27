import type { AntigravityKey } from '../locales.ts'

export type Network = { mode: 'auto' | 'direct' | 'proxy', url: string, effective: string }

export interface NetworkTabProps {
  t: (key: AntigravityKey, params?: Record<string, unknown>) => string
  network?: Network
  setNetwork: (network: Network) => void
  savingNetwork: boolean
  saveNetwork: () => void
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
  } = props

  if (!network) return null

  return (
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
          onClick={saveNetwork}
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
  )
}
