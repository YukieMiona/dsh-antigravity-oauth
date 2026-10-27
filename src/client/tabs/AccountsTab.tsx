import type { AccountQuotaSummary, AccountSummary } from '../../types.ts'
import type { AntigravityKey } from '../locales.ts'
import { evaluateQuotaMetrics as getAccountQuotaMetrics } from '../../quota-core.ts'

export interface AccountsTabProps {
  t: (key: AntigravityKey, params?: Record<string, unknown>) => string
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
  recover: (action: 'retry' | 'reopen' | 'cancel') => void
}

export function AccountsTab(props: AccountsTabProps) {
  const {
    t,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Accounts List & Filter Controls Card */}
      {accounts.length > 0 ? (
        <div className="dsh-agy-card">
          {/* Single-Line Minimal Toolbar */}
          <div className="dsh-agy-row dsh-agy-toolbar-row" style={{ gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <input
                type="text"
                className="dsh-agy-input"
                placeholder={t('searchAccountsPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingRight: searchQuery ? '28px' : '10px' }}
              />
              {searchQuery ? (
                <button
                  type="button"
                  aria-label={t('clearSearch')}
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6, color: '#fff' }}
                >
                  ×
                </button>
              ) : null}
            </div>

            <div className="dsh-agy-toolbar-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              {/* Modern Segmented Sort Toggle */}
              <div className="dsh-agy-segmented">
                <button
                  type="button"
                  className={'dsh-agy-segmented-btn ' + (sortBy === 'default' ? 'is-active' : '')}
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                  onClick={() => setSortBy('default')}
                  title={t('sortDefault')}
                >
                  {t('sortDefaultShort')}
                </button>
                <button
                  type="button"
                  className={'dsh-agy-segmented-btn ' + (sortBy === 'quota' ? 'is-active' : '')}
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                  onClick={() => setSortBy('quota')}
                  title={t('sortQuota')}
                >
                  ⚡ {t('sortQuotaShort')}
                </button>
              </div>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer', color: '#b0b4ba', userSelect: 'none' }}>
                <input type="checkbox" checked={compactView} onChange={e => setCompactView(e.target.checked)} style={{ cursor: 'pointer' }} />
                <span>{t('compactView')}</span>
              </label>
            </div>
          </div>

          {/* Accounts Items List */}
          <div className={'dsh-agy-account-list ' + (compactView ? 'is-compact-mode' : '')}>
            {filteredAccounts.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
                {t('noMatchingAccounts')}
              </div>
            ) : (
              filteredAccounts.map(account => {
                const isActive = account.id === activeAccountId
                const isSwitching = account.id === switchingId
                const metrics = getAccountQuotaMetrics(quotas[account.id])
                const p5h = metrics?.p5h
                const pWeekly = metrics?.pWeekly
                const score = metrics?.score !== undefined ? Math.round(metrics.score) : undefined

                const title5h = p5h !== undefined
                  ? `5h limit: ${p5h}%${metrics?.reset5h ? ` (${t('quotaResetsIn')} ${metrics.reset5h})` : ''}`
                  : '5h limit: Quota not loaded'

                const titleWeekly = pWeekly !== undefined
                  ? `Weekly limit: ${pWeekly}%${metrics?.resetWeekly ? ` (${t('quotaResetsIn')} ${metrics.resetWeekly})` : ''}`
                  : 'Weekly limit: Quota not loaded'

                const titleOverall = score !== undefined
                  ? `Effective bottleneck: ${score}% · 5h: ${p5h}% · Weekly: ${pWeekly}%`
                  : ''

                return (
                  <div
                    key={account.id}
                    className={'dsh-agy-account ' + (isActive ? 'is-active ' : '') + (compactView ? 'is-compact' : '')}
                    onClick={() => { if (!isActive && !switchingId) void switchAccount(account) }}
                  >
                    {/* Tier 1: Email + Active/Remove button */}
                    <div className="dsh-agy-account-header">
                      <div className="dsh-agy-account-info">
                        <input type="radio" checked={isActive} readOnly style={{ cursor: 'pointer', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="dsh-agy-account-mail">{account.email ?? account.id}</span>
                            {isSwitching ? <span className="dsh-agy-status-badge is-switching">{t('working')}...</span> : null}
                            {account.limited ? <span className="dsh-agy-status-badge is-error">{t('accountLimited')}</span> : null}
                            {account.dead ? <span className="dsh-agy-status-badge is-error">{t('accountNeedsRelogin')}</span> : null}
                          </div>
                          {!compactView && account.projectId ? (
                            <span style={{ fontSize: '11px', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis' }}>{account.projectId}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="dsh-agy-account-action" onClick={e => e.stopPropagation()}>
                        {isActive ? (
                          <span className="dsh-agy-action-pill is-active-badge">{t('activeBadge')}</span>
                        ) : (
                          <button
                            type="button"
                            className="dsh-agy-action-pill is-remove-btn"
                            disabled={busy || Boolean(switchingId)}
                            onClick={() => { void removeAccount(account.id) }}
                          >
                            {t('removeAccount')}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tier 2: Quota capsules evenly split 50/50 */}
                    <div className="dsh-agy-account-metrics" onClick={e => e.stopPropagation()} title={titleOverall}>
                      {p5h !== undefined ? (
                        <div className="dsh-agy-capsule-bar" title={title5h}>
                          <div className="dsh-agy-capsule-main">
                            <span>5h {p5h}%</span>
                            <div className="dsh-agy-capsule-progress">
                              <div
                                className={'dsh-agy-capsule-fill ' + (p5h > 40 ? 'is-high' : p5h > 15 ? 'is-med' : 'is-low')}
                                style={{ width: p5h + '%' }}
                              />
                            </div>
                          </div>
                          <span className="dsh-agy-capsule-reset">
                            {metrics?.reset5h ? metrics.reset5h : t('quotaFullyAvailable')}
                          </span>
                        </div>
                      ) : null}

                      {pWeekly !== undefined ? (
                        <div className="dsh-agy-capsule-bar" title={titleWeekly}>
                          <div className="dsh-agy-capsule-main">
                            <span>{t('quotaWeeklyShort')} {pWeekly}%</span>
                            <div className="dsh-agy-capsule-progress">
                              <div
                                className={'dsh-agy-capsule-fill ' + (pWeekly > 40 ? 'is-high' : pWeekly > 15 ? 'is-med' : 'is-low')}
                                style={{ width: pWeekly + '%' }}
                              />
                            </div>
                          </div>
                          <span className="dsh-agy-capsule-reset">
                            {metrics?.resetWeekly ? metrics.resetWeekly : t('quotaFullyAvailable')}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : null}

      {/* Re-authenticate or Confirm Eligibility Recovery Banner */}
      {activeAccount !== undefined && !activeAccount.ready ? (
        <div className="dsh-agy-card">
          <p className="dsh-agy-card-title">{t('authorized')}</p>
          <p className="dsh-agy-body">{t('quotaHint')}</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <button type="button" className="dsh-agy-btn dsh-agy-btn-primary" disabled={busy} onClick={() => { void recover('retry') }}>
              {t('retryEligibility')}
            </button>
            <button type="button" className="dsh-agy-btn dsh-agy-btn-secondary" disabled={busy} onClick={() => { void recover('reopen') }}>
              {t('reopen')}
            </button>
            <button type="button" className="dsh-agy-btn dsh-agy-btn-secondary" disabled={busy} onClick={() => { void recover('cancel') }}>
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
