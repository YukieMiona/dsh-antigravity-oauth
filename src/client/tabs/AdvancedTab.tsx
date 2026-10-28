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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="dsh-agy-card">
        <fieldset className="dsh-agy-field" disabled={savingAdvanced} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend className="dsh-agy-control-label">{t('defaultReasoningEffort')}</legend>
          <div className="dsh-agy-segmented">
            {(['low', 'medium', 'high'] as const).map((effort, index) => (
              <label key={effort} className={'dsh-agy-segmented-btn ' + (advancedEffort === effort ? 'is-active' : '')}>
                <input type="radio" name="agy-effort" value={effort} checked={advancedEffort === effort}
                  onChange={() => setAdvancedEffort(effort)} />
                <span>{t((['effortLow', 'effortMedium', 'effortHigh'] as const)[index])}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="dsh-agy-field" disabled={savingAdvanced} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend className="dsh-agy-control-label">{t('modelContextWindow')}</legend>
          <div className="dsh-agy-segmented">
            {([131072, 262144, 524288, 1048576] as const).map((size, index) => (
              <label key={size} className={'dsh-agy-segmented-btn ' + (advancedContextWindow === size ? 'is-active' : '')}>
                <input type="radio" name="agy-context" value={size} checked={advancedContextWindow === size}
                  onChange={() => setAdvancedContextWindow(size)} />
                <span>{t((['contextWindow128K', 'contextWindow256K', 'contextWindow512K', 'contextWindow1M'] as const)[index])}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="dsh-agy-card">
        <fieldset className="dsh-agy-field" disabled={savingAdvanced} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend className="dsh-agy-control-label">{t('switchingStrategyTitle')}</legend>
          {(['failover_429', 'proactive_threshold', 'round_robin', 'manual'] as const).map((strategy, index) => (
            <label key={strategy} className={'dsh-agy-radio-card ' + (advancedStrategy === strategy ? 'is-active' : '')}>
              <input type="radio" name="agy-strategy" value={strategy} checked={advancedStrategy === strategy}
                onChange={() => setAdvancedStrategy(strategy)} />
              <span className="dsh-agy-choice-label">{t((['strategyFailover', 'strategyProactive', 'strategyRoundRobin', 'strategyManual'] as const)[index])}</span>
            </label>
          ))}
        </fieldset>
        {advancedStrategy === 'proactive_threshold' ? (
          <label className="dsh-agy-field">
            <span className="dsh-agy-control-label">{t('thresholdLabel', { threshold: advancedThreshold })}</span>
            <input type="range" min="10" max="40" step="5" value={advancedThreshold} disabled={savingAdvanced}
              onChange={e => setAdvancedThreshold(Number(e.target.value))} />
          </label>
        ) : null}
        <div className="dsh-agy-actions">
          <button type="button" className="dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact"
            disabled={savingAdvanced} onClick={() => { void saveAdvanced() }}>
            {savingAdvanced ? t('working') : t('saveAdvanced')}
          </button>
        </div>
      </div>
    </div>
  )
}
