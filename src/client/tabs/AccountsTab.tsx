import { useEffect, useState } from 'react'
import type { AccountQuotaSummary, AccountSummary } from '../../types.ts'
import type { AntigravityKey } from '../locales.ts'
import { evaluateQuotaMetrics as getAccountQuotaMetrics } from '../../quota-core.ts'

export interface AccountsTabProps {
  t: (key: AntigravityKey, params?: Record<string, unknown>) => string
  language?: 'en' | 'zh'
  accounts: AccountSummary[]
  activeAccountId?: string
  activeAccount?: AccountSummary
  switchingId: string | null
  busy: boolean
  searchQuery: string
  setSearchQuery: (query: string) => void
  sortBy: 'default' | 'quota'
  setSortBy: (sort: 'default' | 'quota') => void
  compactView: boolean
  setCompactView: (compact: boolean) => void
  quotas: Record<string, AccountQuotaSummary>
  filteredAccounts: AccountSummary[]
  switchAccount: (account: AccountSummary) => void
  removeAccount: (id: string) => void
  recover: (action: 'retry' | 'cancel') => void | Promise<void>
}

function RemoveAccountAction({ label, title, disabled, onRemove }: {
  label: string
  title: string
  disabled: boolean
  onRemove: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const visible = !disabled && !dismissed && (hovered || focused)

  useEffect(() => {
    if (!visible) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Consume this Escape before the host handles it. Keep button focus unchanged.
      event.preventDefault()
      event.stopPropagation()
      setDismissed(true)
    }
    document.addEventListener('keydown', dismiss, true)
    return () => document.removeEventListener('keydown', dismiss, true)
  }, [visible])

  return (
    <div
      className="dsh-agy-remove-control"
      onPointerEnter={() => { setHovered(true); setDismissed(false) }}
      onPointerLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="dsh-agy-btn-icon is-remove-btn"
        disabled={disabled}
        aria-label={label}
        title={title}
        onFocus={() => { setFocused(true); setDismissed(false) }}
        onBlur={() => setFocused(false)}
        onClick={onRemove}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
      <span className={'dsh-agy-remove-tooltip' + (visible ? ' is-visible' : '')} aria-hidden="true">
        <span className="dsh-agy-remove-tooltip-text">{title}</span>
      </span>
    </div>
  )
}

export function AccountsTab(props: AccountsTabProps) {
  const {
    t,
    language = 'en',
    accounts,
    activeAccountId,
    activeAccount,
    switchingId,
    busy,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    compactView,
    setCompactView,
    quotas,
    filteredAccounts,
    switchAccount,
    removeAccount,
    recover,
  } = props

  return (
    <div className="dsh-agy-field dsh-agy-account-panel">
      {/* Accounts List & Filter Controls Card */}
      {accounts.length > 0 ? (
        <div className="dsh-agy-card">
          {/* Minimal Toolbar */}
          <div className="dsh-agy-toolbar-row">
            <div style={{ position: 'relative', flex: '1 1 180px', minWidth: '140px' }}>
              <input
                type="text"
                className="dsh-agy-input"
                aria-label={t('searchAccountsPlaceholder')}
                placeholder={t('searchAccountsPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingRight: searchQuery ? '26px' : '8px' }}
              />
              {searchQuery ? (
                <button
                  type="button"
                  aria-label={t('clearSearch')}
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--dsw-alias-label-secondary, GrayText)',
                    fontSize: '14px',
                    lineHeight: '1',
                    padding: '2px',
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>

            <div className="dsh-agy-actions">
              <div className="dsh-agy-segmented">
                <button
                  type="button"
                  className={'dsh-agy-segmented-btn ' + (sortBy === 'default' ? 'is-active' : '')}
                  onClick={() => setSortBy('default')}
                  aria-pressed={sortBy === 'default'}
                  title={t('sortDefault')}
                >
                  {t('sortDefaultShort')}
                </button>
                <button
                  type="button"
                  className={'dsh-agy-segmented-btn ' + (sortBy === 'quota' ? 'is-active' : '')}
                  onClick={() => setSortBy('quota')}
                  aria-pressed={sortBy === 'quota'}
                  title={t('sortQuota')}
                >
                  {t('sortQuotaShort')}
                </button>
              </div>

              <label className="dsh-agy-control-label">
                <input
                  type="checkbox"
                  checked={compactView}
                  onChange={e => setCompactView(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{t('compactView')}</span>
              </label>
            </div>
          </div>

          {/* Accounts Items List */}
          <div className={'dsh-agy-account-list ' + (compactView ? 'is-compact-mode' : '')}>
            {filteredAccounts.length === 0 ? (
              <div className="dsh-agy-muted">
                {t('noMatchingAccounts')}
              </div>
            ) : (
              filteredAccounts.map(account => {
                const isActive = account.id === activeAccountId
                const isSwitching = account.id === switchingId
                const summary = quotas[account.id]
                const metrics = getAccountQuotaMetrics(summary, language)
                const identity = account.email ?? account.id
                const pending = summary === undefined
                const unavailable = !pending && !metrics
                const cells = [
                  { period: t('quota5h'), value: metrics?.p5h, deadline: metrics?.b5h?.resetTime, countdown: metrics?.reset5h },
                  { period: t('quotaWeekly'), value: metrics?.pWeekly, deadline: metrics?.bWeekly?.resetTime, countdown: metrics?.resetWeekly },
                ]
                const formatReset = (deadline?: string, countdown?: string) => {
                  const resetAt = deadline ? Date.parse(deadline) : NaN
                  if (!Number.isFinite(resetAt)) return ''
                  return resetAt <= Date.now() ? t('quotaResetDue') : t('resetsIn', { time: countdown })
                }

                return (
                  <div
                    key={account.id}
                    className={'dsh-agy-account ' + (isActive ? 'is-active ' : '') + (compactView ? 'is-compact' : '')}
                  >
                    {/* Header: Identity Button on Left, Action Slot on Right */}
                    <div className="dsh-agy-account-header">
                      <div className="dsh-agy-account-info">
                        <button
                          type="button"
                          className="dsh-agy-account-mail"
                          title={account.email ?? account.id}
                          aria-label={isActive ? t('currentAccountAria', { email: identity }) : identity}
                          aria-pressed={isActive}
                          disabled={busy || Boolean(switchingId) || isActive}
                          onClick={() => {
                            if (!busy && !switchingId && !isActive) switchAccount(account)
                          }}
                        >
                          <span className="dsh-agy-account-email-text">{account.email ?? account.id}</span>
                          {isActive ? (
                            <span className="dsh-agy-account-check" aria-hidden="true">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                          ) : (
                            <span className="dsh-agy-account-check is-placeholder" aria-hidden="true" />
                          )}
                        </button>
                        {isSwitching ? (
                          <span className="dsh-agy-status-badge is-switching">{t('working')}</span>
                        ) : null}
                        {account.limited ? (
                          <span className="dsh-agy-status-badge is-error">{t('accountLimited')}</span>
                        ) : null}
                        {account.dead ? (
                          <span className="dsh-agy-status-badge is-error">{t('accountNeedsRelogin')}</span>
                        ) : null}
                      </div>

                      <div className="dsh-agy-account-action">
                        {!isActive ? (
                          <RemoveAccountAction
                            disabled={busy || Boolean(switchingId)}
                            label={t('removeAccountAria', { email: account.email ?? account.id })}
                            title={t('removeAccount')}
                            onRemove={() => {
                              if (!busy && !switchingId) removeAccount(account.id)
                            }}
                          />
                        ) : null}
                      </div>
                    </div>

                    {pending || unavailable ? (
                      <div className="dsh-agy-account-quota-state">
                        {t(pending ? 'quotaPending' : 'quotaUnavailable')}
                      </div>
                    ) : null}
                    <div className="dsh-agy-account-metrics">
                      {cells.map(({ period, value: rawValue, deadline, countdown }, index) => {
                        const value = Number.isFinite(rawValue) ? rawValue : undefined
                        return (
                          <div className="dsh-agy-quota-col" key={index}>
                            <div className="dsh-agy-quota-row-label">
                              <span className="dsh-agy-quota-period">{period}</span>
                              <span className="dsh-agy-quota-pct">{value !== undefined ? `${value}%` : '—'}</span>
                            </div>
                            <div
                              className="dsh-agy-quota-track"
                              role="progressbar"
                              aria-label={value === undefined
                                ? t(pending ? 'meterPendingAria' : 'meterUnknownAria', { period })
                                : t('meterAria', { period, pct: value })}
                              aria-valuenow={value}
                              aria-valuemin={value !== undefined ? 0 : undefined}
                              aria-valuemax={value !== undefined ? 100 : undefined}
                            >
                              <div
                                className={'dsh-agy-capsule-fill ' + (value !== undefined ? (value > 40 ? 'is-high' : value > 15 ? 'is-med' : 'is-low') : '')}
                                style={{ width: value !== undefined ? `${value}%` : '0%' }}
                              />
                            </div>
                            <div className="dsh-agy-quota-reset">{formatReset(deadline, countdown)}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : null}

      {/* Recovery Card when active account needs eligibility confirmation */}
      {activeAccount !== undefined && !activeAccount.ready ? (
        <div className="dsh-agy-card">
          <p className="dsh-agy-card-title">{t('authorized')}</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
            <button
              type="button"
              className="dsh-agy-btn dsh-agy-btn-primary"
              disabled={busy || Boolean(switchingId)}
              onClick={() => { void recover('retry') }}
            >
              {t('retryEligibility')}
            </button>
            <button
              type="button"
              className="dsh-agy-btn dsh-agy-btn-secondary"
              disabled={busy}
              onClick={() => { void recover('cancel') }}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}