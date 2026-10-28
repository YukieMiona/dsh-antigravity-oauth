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
<div className="dsh-agy-field">
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
                const metrics = getAccountQuotaMetrics(quotas[account.id], language)
                const p5h = metrics?.p5h
                const pWeekly = metrics?.pWeekly

                return (
                  <div
                    key={account.id}
                    className={'dsh-agy-account ' + (isActive ? 'is-active ' : '') + (compactView ? 'is-compact' : '')}
                  >
                    {/* Header: Identity Button, Status Badges */}
                    <div className="dsh-agy-account-header">
                      <div className="dsh-agy-account-info">
                        <button
                          type="button"
                          className="dsh-agy-account-mail"
                          title={account.email ?? account.id}
                          aria-label={account.email ?? account.id}
                          aria-pressed={isActive}
                          disabled={busy || Boolean(switchingId) || isActive}
                          onClick={() => {
                            if (!busy && !switchingId && !isActive) switchAccount(account)
                          }}
                        >
                          {account.email ?? account.id}
                        </button>
                        {isSwitching ? (
                          <span className="dsh-agy-status-badge is-switching">{t('working')}...</span>
                        ) : null}
                        {account.limited ? (
                          <span className="dsh-agy-status-badge is-error">{t('accountLimited')}</span>
                        ) : null}
                        {account.dead ? (
                          <span className="dsh-agy-status-badge is-error">{t('accountNeedsRelogin')}</span>
                        ) : null}
                      </div>
                    </div>
                    {/* Consistent 64px Action Slot across active and inactive */}
                    <div className="dsh-agy-account-action">
                      {isActive ? (
                        <span className="dsh-agy-action-pill is-active-badge">{t('activeBadge')}</span>
                      ) : (
                        <button
                          type="button"
                          className="dsh-agy-action-pill is-remove-btn"
                          disabled={busy || Boolean(switchingId)}
                          aria-label={t('removeAccount') + ' ' + (account.email ?? account.id)}
                          onClick={() => {
                            if (!busy && !switchingId) removeAccount(account.id)
                          }}
                        >{t('removeAccount')}</button>
                      )}
                    </div>

                    {/* Fluid Quota Metrics Row */}
                    {(p5h !== undefined || pWeekly !== undefined) ? (
                      <div className="dsh-agy-account-metrics">
                        {p5h !== undefined ? (
                          <div className="dsh-agy-capsule-bar">
                            <span className="dsh-agy-muted">5h</span>
                            <div className="dsh-agy-capsule-main">
                              <div className="dsh-agy-capsule-progress">
                                <div
                                  className={'dsh-agy-capsule-fill ' + (p5h > 40 ? 'is-high' : p5h > 15 ? 'is-med' : 'is-low')}
                                  style={{ width: p5h + '%' }}
                                />
                              </div>
                              <span className="dsh-agy-capsule-val">{`${p5h}%`}</span>
                            </div>
                            {metrics?.reset5h ? (
                              <span className="dsh-agy-capsule-reset">{metrics.reset5h}</span>
                            ) : null}
                          </div>
                        ) : null}

                        {pWeekly !== undefined ? (
                          <div className="dsh-agy-capsule-bar">
                            <span className="dsh-agy-muted">
                              {t('quotaWeeklyShort')}
                            </span>
                            <div className="dsh-agy-capsule-main">
                              <div className="dsh-agy-capsule-progress">
                                <div
                                  className={'dsh-agy-capsule-fill ' + (pWeekly > 40 ? 'is-high' : pWeekly > 15 ? 'is-med' : 'is-low')}
                                  style={{ width: pWeekly + '%' }}
                                />
                              </div>
                              <span className="dsh-agy-capsule-val">{`${pWeekly}%`}</span>
                            </div>
                            {metrics?.resetWeekly ? (
                              <span className="dsh-agy-capsule-reset">{metrics.resetWeekly}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
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