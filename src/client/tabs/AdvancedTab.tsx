import type { AntigravityKey } from '../locales.ts'
import { DEFAULT_CATALOG_MODELS, type ModelCatalogItem } from '../../models.ts'

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
  advancedEnabledModels: string[]
  setAdvancedEnabledModels: (models: string[]) => void
  availableModels?: ModelCatalogItem[]
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
    advancedEnabledModels,
    setAdvancedEnabledModels,
    availableModels,
    savingAdvanced,
    saveAdvanced,
  } = props

  const modelList = availableModels && availableModels.length > 0 ? availableModels : DEFAULT_CATALOG_MODELS
  const contextLabel = (tokens: number): string => tokens >= 1_000_000
    ? `${Math.round((tokens / 1_048_576) * 10) / 10}M`
    : `${Math.round(tokens / 1024)}K`
  const toggleModel = (id: string, checked: boolean): void => {
    if (checked) {
      // Keep at least one model, or DSH would have nothing to offer for this provider.
      if (advancedEnabledModels.length > 1) setAdvancedEnabledModels(advancedEnabledModels.filter(m => m !== id))
    } else {
      setAdvancedEnabledModels([...advancedEnabledModels, id])
    }
  }

  return (
    <div className="dsh-agy-stack">
      <div className="dsh-agy-card">
        <fieldset className="dsh-agy-fieldset" disabled={savingAdvanced}>
          <legend className="dsh-agy-section-text">
            <span className="dsh-agy-section-title">{t('enabledModelsTitle')}</span>
            <span className="dsh-agy-section-desc">{t('modelsDesc')}</span>
          </legend>
          <div className="dsh-agy-option-list">
            {modelList.map(model => {
              const isChecked = advancedEnabledModels.includes(model.id)
              const isLast = isChecked && advancedEnabledModels.length === 1
              return (
                <label key={model.id} className={'dsh-agy-option ' + (isChecked ? 'is-active' : '')}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={savingAdvanced || isLast}
                    onChange={() => toggleModel(model.id, isChecked)}
                  />
                  <span className="dsh-agy-option-text">
                    <span className="dsh-agy-option-name">{model.name}</span>
                    <span className="dsh-agy-option-meta">{model.id}</span>
                  </span>
                  <span className="dsh-agy-pills">
                    {model.id === 'gemini-3.8-flash' ? <span className="dsh-agy-pill is-success">{t('modelDefault')}</span> : null}
                    {model.id === 'gemini-4-argon' ? <span className="dsh-agy-pill is-warn">{t('modelArgonNote')}</span> : null}
                    <span className="dsh-agy-pill">{t('contextShort', { size: contextLabel(model.contextWindow) })}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      </div>

      <div className="dsh-agy-card">
        <fieldset className="dsh-agy-fieldset" disabled={savingAdvanced}>
          <legend className="dsh-agy-section-text">
            <span className="dsh-agy-section-title">{t('defaultReasoningEffort')}</span>
            <span className="dsh-agy-section-desc">{t('effortDesc')}</span>
          </legend>
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
        <hr className="dsh-agy-divider" />
        <fieldset className="dsh-agy-fieldset" disabled={savingAdvanced}>
          <legend className="dsh-agy-section-text">
            <span className="dsh-agy-section-title">{t('modelContextWindow')}</span>
            <span className="dsh-agy-section-desc">{t('contextDesc')}</span>
          </legend>
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
        <fieldset className="dsh-agy-fieldset" disabled={savingAdvanced}>
          <legend className="dsh-agy-section-text">
            <span className="dsh-agy-section-title">{t('switchingStrategyTitle')}</span>
            <span className="dsh-agy-section-desc">{t('strategyDesc')}</span>
          </legend>
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
            <input type="range" className="dsh-agy-range" min="10" max="40" step="5" value={advancedThreshold} disabled={savingAdvanced}
              onChange={e => setAdvancedThreshold(Number(e.target.value))} />
          </label>
        ) : null}
      </div>

      <div className="dsh-agy-actions">
        <button type="button" className="dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact"
          disabled={savingAdvanced} onClick={() => { void saveAdvanced() }}>
          {savingAdvanced ? t('working') : t('saveAdvanced')}
        </button>
      </div>
    </div>
  )
}
