import type { AntigravityKey } from '../locales.ts'

export interface AdvancedTabProps {
  t: (key: AntigravityKey, params?: Record<string, unknown>) => string
  advancedEffort: 'low' | 'medium' | 'high'
  setAdvancedEffort: (effort: 'low' | 'medium' | 'high') => void
  advancedContextWindow: number
  setAdvancedContextWindow: (window: number) => void
  advancedStrategy: 'failover_429' | 'proactive_threshold' | 'round_robin' | 'manual'
  setAdvancedStrategy: (strategy: 'failover_429' | 'proactive_threshold' | 'round_robin' | 'manual') => void
  advancedThreshold: number
  setAdvancedThreshold: (threshold: number) => void
  savingAdvanced: boolean
  saveAdvanced: () => void
}

export function AdvancedTab(props: AdvancedTabProps) {
  const {
    t,
    advancedEffort,
    setAdvancedEffort,
    advancedContextWindow,
    setAdvancedContextWindow,
    advancedStrategy,
    setAdvancedStrategy,
    advancedThreshold,
    setAdvancedThreshold,
    savingAdvanced,
    saveAdvanced,
  } = props

  return (
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
  )
}
