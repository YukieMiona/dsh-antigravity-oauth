// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AccountsTab, type AccountsTabProps } from '../src/client/tabs/AccountsTab.tsx'
import { AntigravitySettings } from '../src/client/Settings.tsx'
import { SETTINGS_CSS } from '../src/client/theme.ts'
import { en, zh, type AntigravityKey } from '../src/client/locales.ts'
import type { AccountQuotaSummary, AccountSummary } from '../src/types.ts'
import { evaluateQuotaMetrics, formatShortCountdown } from '../src/quota-core.ts'

const translate = (language: 'en' | 'zh') => (key: AntigravityKey, params?: Record<string, unknown>) => {
  let result: string = (language === 'zh' ? zh : en)[key]
  for (const [key, value] of Object.entries(params ?? {})) result = result.replace('{' + key + '}', String(value))
  return result
}
const t = translate('en')
const accounts: AccountSummary[] = [
  { id: 'one', email: 'one@example.test', ready: true, limited: false, dead: false },
  { id: 'two', email: 'two@example.test', ready: true, limited: true, dead: false },
]
const quota = (reset: string): AccountQuotaSummary => ({
  accountId: 'one', ok: true,
  groups: [{ displayName: 'Gemini', buckets: [
    { bucketId: '5h', window: '5h', remainingFraction: .8, resetTime: reset },
    { bucketId: 'weekly', window: 'weekly', remainingFraction: .5, resetTime: reset },
  ] }],
})
let container: HTMLDivElement
let root: Root
async function render(element: React.ReactNode) { await act(async () => root.render(element)) }
async function click(element: HTMLElement) { await act(async () => element.click()) }
async function movePointer(from: Element | null, to: Element | null) {
  await act(async () => {
    from?.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: to }))
    to?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, relatedTarget: from }))
  })
}
async function pressKey(target: EventTarget, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  await act(async () => { target.dispatchEvent(event) })
  return event
}
function button(text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find(el =>
    (el.getAttribute('aria-label') ?? el.textContent?.trim()) === text
  )
  if (!found) throw new Error('Missing button: ' + text)
  return found
}
function defaults(overrides: Partial<AccountsTabProps> = {}): AccountsTabProps {
  return { t, language: 'en', accounts, activeAccountId: 'one', activeAccount: accounts[0],
    switchingId: null, busy: false, searchQuery: '', setSearchQuery: vi.fn(), sortBy: 'default', setSortBy: vi.fn(),
    compactView: false, setCompactView: vi.fn(), quotas: { one: quota(new Date(Date.now() + 172800000).toISOString()) },
    filteredAccounts: accounts, switchAccount: vi.fn(), removeAccount: vi.fn(), recover: vi.fn(), ...overrides }
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  localStorage.clear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.head.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Mounted account controls', () => {
  it('switches only through the native identity button and separates Remove', async () => {
    const props = defaults()
    await render(React.createElement(AccountsTab, props))
    const identity = button('two@example.test')
    expect(identity.type).toBe('button')
    expect(identity.getAttribute('aria-label')).toBe('two@example.test')
    identity.focus()
    expect(document.activeElement).toBe(identity)
    await click(identity)
    expect(props.switchAccount).toHaveBeenCalledExactlyOnceWith(accounts[1])
    vi.mocked(props.switchAccount).mockClear()
    await click(container.querySelectorAll<HTMLElement>('.dsh-agy-account')[1])
    expect(props.switchAccount).not.toHaveBeenCalled()
    await click(button(t('removeAccountAria', { email: 'two@example.test' })))
    expect(props.removeAccount).toHaveBeenCalledExactlyOnceWith('two')
    expect(props.switchAccount).not.toHaveBeenCalled()
    expect(button(t('currentAccountAria', { email: 'one@example.test' })).getAttribute('aria-pressed')).toBe('true')
    expect(button(t('currentAccountAria', { email: 'one@example.test' })).disabled).toBe(true)
  })
  it.each([{ busy: true }, { switchingId: 'one' }])('blocks native account actions while %o', async state => {
    const props = defaults(state)
    await render(React.createElement(AccountsTab, props))
    for (const el of [button('two@example.test'), button(t('removeAccountAria', { email: 'two@example.test' }))]) {
      expect(el.disabled).toBe(true)
      await click(el)
    }
    expect(props.switchAccount).not.toHaveBeenCalled()
    expect(props.removeAccount).not.toHaveBeenCalled()
  })
  it.each(['en', 'zh'] as const)('uses %s quota countdowns including expired and missing values', async language => {
    await render(React.createElement(AccountsTab, defaults({ language, t: translate(language) })))
    expect(container.textContent).toContain(language === 'zh' ? '天' : 'd')
    expect(container.textContent).not.toContain(language === 'zh' ? 'Refreshed' : '天')
    await render(React.createElement(AccountsTab, defaults({ language, t: translate(language), quotas: { one: quota('2000-01-01T00:00:00Z') } })))
    expect(container.textContent).toContain(language === 'zh' ? '已到重置时间' : 'Reset due')
    await render(React.createElement(AccountsTab, defaults({ language, quotas: {} })))
    expect(container.querySelector('.dsh-agy-quota-reset')?.textContent).toBe('')
    expect(container.querySelector('.dsh-agy-quota-pct')?.textContent).toBe('—')
    expect(container.querySelector('.dsh-agy-quota-track')?.getAttribute('aria-valuenow')).toBeNull()
  })
  it('keeps typography stable when density changes in the DOM CSS engine', async () => {
    // happy-dom does not implement browser layout, container queries, or physical zoom.
    const style = document.createElement('style')
    style.textContent = SETTINGS_CSS
    document.head.append(style)
    await render(React.createElement(AccountsTab, defaults()))
    const normal = getComputedStyle(button('two@example.test')).fontSize
    const reset = getComputedStyle(container.querySelector('.dsh-agy-quota-reset')!).fontSize
    expect(normal).toBe('13px')
    expect(reset).toBe('11px')
    await render(React.createElement(AccountsTab, defaults({ compactView: true })))
    expect(getComputedStyle(button('two@example.test')).fontSize).toBe(normal)
    expect(getComputedStyle(container.querySelector('.dsh-agy-quota-reset')!).fontSize).toBe(reset)
    expect(container.querySelectorAll('.dsh-agy-account.is-compact')).toHaveLength(2)
  })

  it('resists twice-length pseudolocalization without crashing or breaking structure (G08)', async () => {
    // Double-length test translation
    const pseudoTranslate = (key: AntigravityKey, params?: Record<string, unknown>) => {
      let base: string = String(en[key] ?? key)
      for (const [k, v] of Object.entries(params ?? {})) base = base.replace('{' + k + '}', String(v))
      return '[LONG ' + base + ' ' + base + ']'
    }
    const props = defaults({
      t: pseudoTranslate,
      quotas: {
        one: {
          accountId: 'one', ok: true,
          groups: [{ displayName: 'Gemini', buckets: [
            { bucketId: '5h', window: '5h', remainingFraction: .6, resetTime: new Date(Date.now() + 3600000).toISOString() },
            { bucketId: 'weekly', window: 'weekly', remainingFraction: .2, resetTime: new Date(Date.now() + 86400000).toISOString() },
          ] }]
        }
      }
    })
    await render(React.createElement(AccountsTab, props))

    const activeRow = container.querySelectorAll('.dsh-agy-account')[0]
    expect(activeRow).not.toBeNull()
    const quotaCols = activeRow.querySelectorAll('.dsh-agy-quota-col')
    expect(quotaCols).toHaveLength(2)

    // Tracks remain present and distinct even with twice-length labels
    expect(quotaCols[0].querySelector('.dsh-agy-quota-track')).not.toBeNull()
    expect(quotaCols[1].querySelector('.dsh-agy-quota-track')).not.toBeNull()
    expect(quotaCols[0].querySelector('.dsh-agy-quota-pct')?.textContent).toBe('60%')
    expect(quotaCols[1].querySelector('.dsh-agy-quota-pct')?.textContent).toBe('20%')
  })

  it('keeps known zero (0%), missing data, and exhausted states distinct (G09)', async () => {
    const props = defaults({
      quotas: {
        one: {
          accountId: 'one', ok: true,
          groups: [{ displayName: 'Gemini', buckets: [
            { bucketId: '5h', window: '5h', remainingFraction: 0, resetTime: new Date(Date.now() + 3600000).toISOString() },
            { bucketId: 'weekly', window: 'weekly', remainingFraction: .5, resetTime: new Date(Date.now() + 86400000).toISOString() },
          ] }]
        },
        two: {
          accountId: 'two', ok: true,
          groups: [{ displayName: 'Gemini', buckets: [
            // 5h bucket omitted: missing data
            { bucketId: 'weekly', window: 'weekly', remainingFraction: .8, resetTime: new Date(Date.now() + 86400000).toISOString() },
          ] }]
        }
      }
    })
    await render(React.createElement(AccountsTab, props))

    const rows = container.querySelectorAll('.dsh-agy-account')

    // Row 1 (True zero on 5h): displays '0%' and aria-valuenow=0
    const row1_5h = rows[0].querySelectorAll('.dsh-agy-quota-col')[0]
    expect(row1_5h.querySelector('.dsh-agy-quota-pct')?.textContent).toBe('0%')
    expect(row1_5h.querySelector('.dsh-agy-quota-track')?.getAttribute('aria-valuenow')).toBe('0')

    // Row 2 (Missing 5h bucket): displays '—' and no aria-valuenow
    const row2_5h = rows[1].querySelectorAll('.dsh-agy-quota-col')[0]
    expect(row2_5h.querySelector('.dsh-agy-quota-pct')?.textContent).toBe('—')
    expect(row2_5h.querySelector('.dsh-agy-quota-track')?.getAttribute('aria-valuenow')).toBeNull()

    // Row 2 weekly is still present and valid
    const row2_weekly = rows[1].querySelectorAll('.dsh-agy-quota-col')[1]
    expect(row2_weekly.querySelector('.dsh-agy-quota-pct')?.textContent).toBe('80%')
    expect(row2_weekly.querySelector('.dsh-agy-quota-track')?.getAttribute('aria-valuenow')).toBe('80')
  })
})



describe('Quota states and accessibility', () => {
  it.each(['en', 'zh'] as const)('names current and Remove controls exactly in %s', async language => {
    const tr = translate(language)
    const email = 'a-very-long-address.with.extra.parts@synthetic.example.test'
    const fixtures = [accounts[0], { ...accounts[1], email }]
    await render(React.createElement(AccountsTab, defaults({ t: tr, language, accounts: fixtures, filteredAccounts: fixtures })))
    const current = button(tr('currentAccountAria', { email: accounts[0].email }))
    expect(current.disabled).toBe(true)
    expect(current.getAttribute('aria-pressed')).toBe('true')
    expect(button(email).getAttribute('aria-pressed')).toBe('false')
    expect(button(tr('removeAccountAria', { email })).getAttribute('aria-label')).toBe(tr('removeAccountAria', { email }))
    expect(container.querySelector('.dsh-agy-account-action')?.children).toHaveLength(0)
    expect(current.lastElementChild?.classList.contains('dsh-agy-account-check')).toBe(true)
    expect(container.querySelector('.dsh-agy-account-email-text')?.nextElementSibling?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.dsh-agy-active-tag')).toBeNull()
  })
  it.each(['en', 'zh'] as const)('keeps the translated Remove tooltip open across button, gap, and text in %s', async language => {
    const style = document.createElement('style')
    style.textContent = SETTINGS_CSS
    document.head.append(style)
    const tr = translate(language)
    const props = defaults({ t: tr, language })
    await render(React.createElement(AccountsTab, props))
    const remove = button(tr('removeAccountAria', { email: accounts[1].email }))
    const control = remove.parentElement!
    const tooltip = control.querySelector<HTMLElement>('.dsh-agy-remove-tooltip')!
    const text = tooltip.querySelector<HTMLElement>('.dsh-agy-remove-tooltip-text')!
    const visibility = () => {
      // Reload identical rules to clear HappyDOM's matched-rule cache, not to emulate hover.
      style.textContent = SETTINGS_CSS
      return getComputedStyle(tooltip).visibility
    }
    expect(remove.title).toBe(tr('removeAccount'))
    expect(tooltip.textContent).toBe(tr('removeAccount'))
    expect(tooltip.getAttribute('aria-hidden')).toBe('true')
    expect(remove.contains(tooltip)).toBe(false)
    expect(getComputedStyle(tooltip).position).toBe('absolute')
    expect(getComputedStyle(tooltip).top).toBe('100%')
    expect(getComputedStyle(tooltip).paddingTop).toBe('4px')
    expect(getComputedStyle(tooltip).pointerEvents).toBe('auto')
    expect(getComputedStyle(control).width).toBe('28px')
    expect(visibility()).toBe('hidden')
    await movePointer(null, remove)
    expect(document.activeElement).not.toBe(remove)
    expect(visibility()).toBe('visible')
    for (const [from, to] of [[remove, tooltip], [tooltip, text], [text, remove]]) {
      await movePointer(from, to)
      expect(visibility()).toBe('visible')
    }
    await act(async () => remove.focus())
    await act(async () => remove.blur())
    expect(visibility()).toBe('visible')
    await click(tooltip)
    await click(text)
    expect(props.removeAccount).not.toHaveBeenCalled()
    expect(props.switchAccount).not.toHaveBeenCalled()
    await movePointer(remove, container)
    expect(visibility()).toBe('hidden')
    await act(async () => remove.focus())
    expect(document.activeElement).toBe(remove)
    expect(visibility()).toBe('visible')
    await act(async () => remove.blur())
    expect(visibility()).toBe('hidden')
    // Synthetic transitions prove mounted state and CSS, not native hit testing or paint.
  })
  it('dismisses the Remove tooltip on Escape without losing focus, taking action, or closing its host', async () => {
    const hostEscape = vi.fn()
    const props = defaults()
    await render(React.createElement('div', { onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => { if (event.key === 'Escape') hostEscape() } }, React.createElement(AccountsTab, props)))
    const remove = button(t('removeAccountAria', { email: accounts[1].email }))
    const tooltip = remove.parentElement!.querySelector<HTMLElement>('.dsh-agy-remove-tooltip')!
    const text = tooltip.querySelector<HTMLElement>('.dsh-agy-remove-tooltip-text')!
    await movePointer(null, remove)
    await act(async () => remove.focus())
    expect(tooltip.classList.contains('is-visible')).toBe(true)
    expect((await pressKey(remove, 'Enter')).defaultPrevented).toBe(false)
    expect((await pressKey(remove, ' ')).defaultPrevented).toBe(false)
    expect((await pressKey(remove, 'Escape')).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(remove)
    expect(tooltip.classList.contains('is-visible')).toBe(false)
    for (const [from, to] of [[remove, tooltip], [tooltip, text], [text, remove]]) {
      await movePointer(from, to)
      expect(tooltip.classList.contains('is-visible')).toBe(false)
    }
    await click(text)
    expect(hostEscape).not.toHaveBeenCalled()
    expect(props.removeAccount).not.toHaveBeenCalled()
    expect(props.switchAccount).not.toHaveBeenCalled()
    await movePointer(remove, container)
    expect(tooltip.classList.contains('is-visible')).toBe(false)
    await act(async () => remove.blur())
    await act(async () => remove.focus())
    expect(tooltip.classList.contains('is-visible')).toBe(true)
    await click(remove)
    expect(props.removeAccount).toHaveBeenCalledExactlyOnceWith('two')
    expect(props.switchAccount).not.toHaveBeenCalled()
    // Key dispatch does not prove native Enter/Space activation. The button keeps its native type.
    expect(remove.type).toBe('button')
  })
  it('dismisses a hover-only Remove tooltip until pointer reentry and removes the Escape listener on unmount', async () => {
    await render(React.createElement(AccountsTab, defaults()))
    const remove = button(t('removeAccountAria', { email: accounts[1].email }))
    const tooltip = remove.parentElement!.querySelector<HTMLElement>('.dsh-agy-remove-tooltip')!
    await movePointer(null, remove)
    expect((await pressKey(document.body, 'Escape')).defaultPrevented).toBe(true)
    expect(document.activeElement).not.toBe(remove)
    expect(tooltip.classList.contains('is-visible')).toBe(false)
    await movePointer(remove, tooltip)
    expect(tooltip.classList.contains('is-visible')).toBe(false)
    await movePointer(tooltip, container)
    await movePointer(container, remove)
    expect(tooltip.classList.contains('is-visible')).toBe(true)
    await render(null)
    expect((await pressKey(document.body, 'Escape')).defaultPrevented).toBe(false)
  })
  it.each([{ busy: true }, { switchingId: 'one' }])('hides and locks a hovered Remove tooltip while %o', async state => {
    const props = defaults()
    await render(React.createElement(AccountsTab, props))
    const remove = button(t('removeAccountAria', { email: accounts[1].email }))
    await movePointer(null, remove)
    await render(React.createElement(AccountsTab, { ...props, ...state }))
    expect(remove.disabled).toBe(true)
    expect(remove.parentElement!.querySelector('.dsh-agy-remove-tooltip')!.classList.contains('is-visible')).toBe(false)
    await click(remove)
    expect(props.removeAccount).not.toHaveBeenCalled()
    expect(props.switchAccount).not.toHaveBeenCalled()
    expect((await pressKey(document.body, 'Escape')).defaultPrevented).toBe(false)
  })
  it.each(['en', 'zh'] as const)('keeps both unknown cells for pending, failed, empty, and partial data in %s', async language => {
    const tr = translate(language)
    const partial = quota('not-a-date')
    partial.groups![0].buckets = [partial.groups![0].buckets[1]]
    const fixtures: (AccountQuotaSummary | undefined)[] = [undefined, { accountId: 'one', ok: false }, { accountId: 'one', ok: true, groups: [] }, partial]
    for (const summary of fixtures) {
      await render(React.createElement(AccountsTab, defaults({ t: tr, language, quotas: summary ? { one: summary } : {} })))
      const row = container.querySelector('.dsh-agy-account')!
      expect(row.querySelectorAll('.dsh-agy-quota-col')).toHaveLength(2)
      const meters = Array.from(row.querySelectorAll('[role="progressbar"]'))
      expect(meters).toHaveLength(2)
      const unknown = summary === partial ? [meters[0]] : meters
      for (const meter of unknown) {
        const period = meter.closest('.dsh-agy-quota-col')!.querySelector('.dsh-agy-quota-period')!.textContent!
        expect(meter.getAttribute('aria-label')).toBe(tr(summary ? 'meterUnknownAria' : 'meterPendingAria', { period }))
        expect(meter.getAttribute('aria-label')).not.toContain('0%')
        for (const attribute of ['aria-valuenow', 'aria-valuemin', 'aria-valuemax']) expect(meter.hasAttribute(attribute)).toBe(false)
      }
      const state = row.querySelector('.dsh-agy-account-quota-state')
      expect(state?.textContent ?? null).toBe(summary === partial ? null : tr(summary ? 'quotaUnavailable' : 'quotaPending'))
      if (summary === partial) expect(meters[1].getAttribute('aria-valuenow')).toBe('50')
    }
  })
  it('keeps true zero numeric and does not switch through quota content or remove', async () => {
    const value = quota('2000-01-01T00:00:00Z')
    value.groups![0].buckets[0].remainingFraction = 0
    const props = defaults({ quotas: { one: value, two: value } })
    await render(React.createElement(AccountsTab, props))
    const row = container.querySelectorAll<HTMLElement>('.dsh-agy-account')[1]
    const meter = row.querySelector('[role="progressbar"]')!
    expect(meter.getAttribute('aria-label')).toBe(t('meterAria', { period: t('quota5h'), pct: 0 }))
    expect(meter.getAttribute('aria-valuenow')).toBe('0')
    expect(meter.getAttribute('aria-valuemin')).toBe('0')
    expect(meter.getAttribute('aria-valuemax')).toBe('100')
    for (const selector of ['.dsh-agy-account-metrics', '.dsh-agy-quota-row-label', '.dsh-agy-quota-track', '.dsh-agy-quota-reset']) await click(row.querySelector<HTMLElement>(selector)!)
    await click(row)
    expect(props.switchAccount).not.toHaveBeenCalled()
    expect(props.removeAccount).not.toHaveBeenCalled()
    await click(button(t('removeAccountAria', { email: accounts[1].email })))
    expect(props.removeAccount).toHaveBeenCalledExactlyOnceWith('two')
    expect(props.switchAccount).not.toHaveBeenCalled()
    await click(button('two@example.test'))
    expect(props.switchAccount).toHaveBeenCalledExactlyOnceWith(accounts[1])
    expect(props.removeAccount).toHaveBeenCalledTimes(1)
    expect(row.querySelector('.dsh-agy-account-quota-state')).toBeNull()
  })
  it.each([undefined, '', 'not-a-date', '2000-01-01T00:00:00Z', '2099-01-01T00:00:00Z'])('uses deadlines, not translated countdown text, for reset %s', async deadline => {
    const summary = quota(deadline as string)
    const tr = (key: AntigravityKey, params?: Record<string, unknown>) => key === 'quotaResetDue' ? 'Elapsed fixture' : t(key, params)
    await render(React.createElement(AccountsTab, defaults({ t: tr, quotas: { one: summary } })))
    const row = container.querySelector('.dsh-agy-account')!
    const text = row.querySelector('.dsh-agy-quota-reset')!.textContent!
    expect(text).toBe(deadline?.startsWith('2000') ? 'Elapsed fixture' : deadline?.startsWith('2099') ? t('resetsIn', { time: formatShortCountdown(deadline, 'en') }) : '')
    expect(row.textContent).not.toMatch(/NaN|undefined|Refreshed/)
    expect(row.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('80')
  })
  it('mounts long reset and one-sided long label text in shared grid children', async () => {
    const tr = (key: AntigravityKey, params?: Record<string, unknown>) => key === 'quotaWeekly' ? 'Weekly label '.repeat(12) : key === 'resetsIn' ? t(key, params).repeat(8) : t(key, params)
    await render(React.createElement(AccountsTab, defaults({ t: tr })))
    const row = container.querySelector('.dsh-agy-account')!
    expect(row.children[0].className).toBe('dsh-agy-account-header')
    const metrics = row.children[1]
    expect(metrics.className).toBe('dsh-agy-account-metrics')
    expect(Array.from(metrics.children).map(cell => Array.from(cell.children).map(child => child.className))).toEqual(Array(2).fill(['dsh-agy-quota-row-label', 'dsh-agy-quota-track', 'dsh-agy-quota-reset']))
    expect(metrics.children[1].querySelector('.dsh-agy-quota-period')?.textContent).toBe('Weekly label '.repeat(12))
    expect(metrics.querySelector('.dsh-agy-quota-reset')!.textContent!.length).toBeGreaterThan(80)
  })
  it('preserves limited, dead, working, and recovery action ownership', async () => {
    const dead = { ...accounts[0], ready: false, dead: true }
    const props = defaults({ activeAccount: dead, accounts: [dead, accounts[1]], filteredAccounts: [dead, accounts[1]], switchingId: 'two' })
    await render(React.createElement(AccountsTab, props))
    expect(container.textContent).toContain(en.accountNeedsRelogin)
    expect(container.textContent).toContain(en.accountLimited)
    expect(container.textContent).toContain(en.working)
    expect(button(en.retryEligibility).disabled).toBe(true)
    expect(button(en.cancel).disabled).toBe(false)
    await click(button(en.cancel))
    expect(props.recover).toHaveBeenCalledExactlyOnceWith('cancel')
    await render(React.createElement(AccountsTab, { ...props, switchingId: null }))
    await click(button(en.retryEligibility))
    expect(props.recover).toHaveBeenLastCalledWith('retry')
    expect(props.recover).toHaveBeenCalledTimes(2)
  })
})

describe('Shared reset formatter and unchanged metric selection', () => {
  it.each(['en', 'zh'] as const)('handles invalid, missing, elapsed, and future deadlines in %s', language => {
    const now = Date.UTC(2026, 9, 29)
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(formatShortCountdown(undefined, language)).toBe('-')
    expect(formatShortCountdown('invalid', language)).toBe('-')
    expect(formatShortCountdown(new Date(now).toISOString(), language)).toBe(language === 'zh' ? '已到重置时间' : 'Reset due')
    expect(formatShortCountdown(new Date(now - 1).toISOString(), language)).toBe(language === 'zh' ? '已到重置时间' : 'Reset due')
    for (const [minutes, english, chinese] of [[2, '2m', '2分'], [90, '1h30m', '1小时30分'], [1500, '1d1h', '1天1小时'], [2880, '2d', '2天']] as const) {
      expect(formatShortCountdown(new Date(now + minutes * 60000).toISOString(), language)).toBe(language === 'zh' ? chinese : english)
    }
  })
  it('preserves Gemini preference, 3p exclusion, score, and exhaustion for all consumers', () => {
    const summary = quota('2000-01-01T00:00:00Z')
    summary.groups![0].buckets.unshift({ bucketId: '3p-5h', window: '5h', remainingFraction: 1 }, { bucketId: 'gemini-5h', window: '5h', remainingFraction: .09 })
    const metrics = evaluateQuotaMetrics(summary, 'en')!
    expect(metrics.b5h?.bucketId).toBe('gemini-5h')
    expect(metrics.p5h).toBe(9)
    expect(metrics.pWeekly).toBe(50)
    expect(metrics.score).toBe(9)
    expect(metrics.isExhausted).toBe(true)
    expect(metrics.resetWeekly).toBe('Reset due')
    expect(evaluateQuotaMetrics({ accountId: 'none', ok: true, groups: [{ displayName: '3p', buckets: [{ bucketId: '3p-5h', window: '5h', remainingFraction: 1 }] }] })).toBeUndefined()
  })
})

function stubSettings(override?: (path: string, init?: RequestInit) => Promise<Response> | undefined) {
  return vi.stubGlobal('fetch', vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const path = String(input)
    const custom = override?.(path, init)
    if (custom) return custom
    let data: unknown = {}
    if (path.includes('/auth/status')) data = { status: 'signed-in', activeId: 'one', accounts }
    else if (path.includes('/auth/accounts/quotas')) data = { accounts: [] }
    else if (path.includes('/network')) data = { mode: 'direct', proxyUrl: '' }
    else if (path.includes('/web2api/settings')) data = { enabled: false, baseUrl: 'http://localhost:18088', apiKey: '', enableImageTool: false }
    return Promise.resolve(new Response(JSON.stringify(data), { status: 200 }))
  }))
}
describe('Mounted Settings with isolated fetch', () => {
  it('opens login and blocks account switching while login remains pending', async () => {
    let finish!: (response: Response) => void
    const pending = new Promise<Response>(resolve => { finish = resolve })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    stubSettings(path => path.includes('/auth/login') ? pending : undefined)
    await render(React.createElement(AntigravitySettings, { t }))
    await act(async () => { button(en.addAccount).click(); button('two@example.test').click() })
    expect(button('two@example.test').disabled).toBe(true)
    expect(vi.mocked(fetch).mock.calls.filter(([path]) => String(path).includes('/accounts/switch'))).toHaveLength(0)
    await act(async () => finish(new Response(JSON.stringify({ url: 'https://accounts.example.test/authorize' }))))
    expect(open).toHaveBeenCalledExactlyOnceWith('https://accounts.example.test/authorize', '_blank', 'noopener,noreferrer')
    expect(button('two@example.test').disabled).toBe(false)
  })
  it('keeps the callback after failure and clears it after successful completion', async () => {
    let fail = true
    stubSettings(path => {
      if (path.includes('/auth/status')) return Promise.resolve(new Response(JSON.stringify({ status: 'signing-in', url: 'https://accounts.example.test/authorize', accounts })))
      if (path.includes('/auth/complete')) return Promise.resolve(new Response(JSON.stringify(fail ? { error: 'Fixture callback rejected' } : { ok: true }), { status: fail ? 400 : 200 }))
      return undefined
    })
    await render(React.createElement(AntigravitySettings, { t }))
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://accounts.example.test/authorize')
    const input = container.querySelector<HTMLInputElement>('input[placeholder="' + en.completePlaceholder + '"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '  https://callback.example.test/?code=fixture  ')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click(button(en.complete))
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Fixture callback rejected')
    expect(input.value).toBe('  https://callback.example.test/?code=fixture  ')
    const call = vi.mocked(fetch).mock.calls.find(([path]) => String(path).includes('/auth/complete'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ url: 'https://callback.example.test/?code=fixture' })
    fail = false
    await click(button(en.complete))
    expect(input.value).toBe('')
  })
  it('keeps retry and cancel recovery controls connected to their original endpoints', async () => {
    stubSettings(path => {
      if (path.includes('/auth/status')) {
        return Promise.resolve(new Response(JSON.stringify({
          status: 'signed-in',
          activeId: 'one',
          accounts: [{ id: 'one', email: 'one@example.test', ready: false, limited: false, dead: false }],
        })))
      }
      return undefined
    })
    await render(React.createElement(AntigravitySettings, { t }))
    await click(button(en.retryEligibility))
    await click(button(en.cancel))
    for (const action of ['retry', 'cancel']) {
      expect(vi.mocked(fetch).mock.calls.some(([path, init]) => String(path).endsWith('/auth/' + action) && init?.method === 'POST')).toBe(true)
    }
  })
  it('keeps notice independent of compact view and restores it after remount', async () => {
    stubSettings()
    await render(React.createElement(AntigravitySettings, { t }))
    expect(container.textContent).toContain(en.tos)
    await click(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!)
    expect(container.textContent).toContain(en.tos)
    await click(container.querySelector<HTMLButtonElement>('[aria-label="Dismiss notice"]')!)
    expect(container.textContent).not.toContain(en.tos)
    expect(localStorage.getItem('dsh-antigravity-oauth.dismissed-banner')).toBe('true')
    await act(async () => root.unmount())
    root = createRoot(container)
    await render(React.createElement(AntigravitySettings, { t }))
    expect(container.textContent).not.toContain(en.tos)
    await click(button(en.restoreNotice))
    expect(container.textContent).toContain(en.tos)
    expect(localStorage.getItem('dsh-antigravity-oauth.dismissed-banner')).toBeNull()
  })
  it('locks duplicate switches and Add while a switch request remains pending', async () => {
    let finish!: (response: Response) => void
    const pending = new Promise<Response>(resolve => { finish = resolve })
    stubSettings((path, init) => path.includes('/accounts/switch') && init?.method === 'POST' ? pending : undefined)
    await render(React.createElement(AntigravitySettings, { t }))
    // Two clicks in one React batch exercise the immediate ref guard, before a render.
    await act(async () => { button('two@example.test').click(); button('two@example.test').click(); button(en.addAccount).click() })
    expect(vi.mocked(fetch).mock.calls.filter(([path]) => String(path).includes('/accounts/switch'))).toHaveLength(1)
    expect(vi.mocked(fetch).mock.calls.filter(([path]) => String(path).includes('/auth/login'))).toHaveLength(0)
    expect(button(en.addAccount).disabled).toBe(true)
    expect(button('two@example.test').disabled).toBe(true)
    await act(async () => finish(new Response(JSON.stringify({ ok: true, account: { status: 'signed-in', activeId: 'two', accounts } }))))
    expect(button(t('currentAccountAria', { email: 'two@example.test' })).getAttribute('aria-pressed')).toBe('true')
    expect(button(en.addAccount).disabled).toBe(false)
  })
  it('preserves the active identity after a failed switch', async () => {
    stubSettings((path, init) => path.includes('/accounts/switch') && init?.method === 'POST'
      ? Promise.resolve(new Response(JSON.stringify({ error: 'Fixture switch failed' }), { status: 500 })) : undefined)
    await render(React.createElement(AntigravitySettings, { t }))
    await click(button('two@example.test'))
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Fixture switch failed')
    expect(button(t('currentAccountAria', { email: 'one@example.test' })).getAttribute('aria-pressed')).toBe('true')
    expect(button('two@example.test').disabled).toBe(false)
  })
})

describe('Theme source contracts, not browser layout proof', () => {
  it('defines shared grid rows, wrapping, density spacing, and stable scroller space', () => {
    const rule = (selector: string) => {
      const start = SETTINGS_CSS.indexOf(selector + ' {')
      expect(start, selector).toBeGreaterThanOrEqual(0)
      const end = SETTINGS_CSS.indexOf('}', start)
      const declaration = document.createElement('div').style
      declaration.cssText = SETTINGS_CSS.slice(start + selector.length + 2, end)
      return declaration
    }
    expect(rule('.dsh-agy-account-panel').getPropertyValue('container-name')).toBe('agy-accounts')
    expect(rule('.dsh-agy-account-panel').getPropertyValue('container-type')).toBe('inline-size')
    expect(rule('.dsh-agy-account-list').getPropertyValue('scrollbar-gutter')).toBe('stable')
    expect(rule('.dsh-agy-account-list').overflowY).toBe('auto')
    expect(rule('.dsh-agy-account').padding).toBe('12px')
    expect(rule('.dsh-agy-account').gap).toBe('8px')
    expect(rule('.dsh-agy-account.is-compact').padding).toBe('6px 12px')
    expect(rule('.dsh-agy-account.is-compact').gap).toBe('4px')
    expect(rule('.dsh-agy-account').getPropertyValue('--quota-track-gap')).toBe('4px')
    expect(rule('.dsh-agy-account.is-compact').getPropertyValue('--quota-track-gap')).toBe('3px')
    expect(rule('.dsh-agy-account').getPropertyValue('--quota-cell-gap')).toBe('12px')
    expect(rule('.dsh-agy-account.is-compact').getPropertyValue('--quota-cell-gap')).toBe('8px')
    expect(rule('.dsh-agy-account-metrics').display).toBe('grid')
    expect(rule('.dsh-agy-account-metrics').gridTemplateRows).toBe('auto 4px auto auto 4px auto')
    expect(rule('.dsh-agy-account-metrics').columnGap).toBe('16px')
    expect(rule('.dsh-agy-quota-col').display).toBe('contents')
    expect(rule('.dsh-agy-quota-row-label').gridRow).toBe('var(--quota-label-row)')
    expect(rule('.dsh-agy-quota-track').gridRow).toBe('var(--quota-track-row)')
    expect(rule('.dsh-agy-quota-reset').gridRow).toBe('var(--quota-reset-row)')
    expect(rule('.dsh-agy-quota-track').height).toBe('4px')
    expect(rule('.dsh-agy-quota-track').margin).toBe('0px')
    expect(rule('.dsh-agy-quota-period').overflowWrap).toBe('anywhere')
    expect(rule('.dsh-agy-quota-reset').whiteSpace).toBe('normal')
    expect(rule('.dsh-agy-quota-reset').overflowWrap).toBe('anywhere')
    expect(rule('.dsh-agy-quota-reset').overflow).not.toBe('hidden')
    expect(rule('.dsh-agy-account-header').gridTemplateColumns).toBe('minmax(0, 1fr) 28px')
    expect(rule('.dsh-agy-account-check').minWidth).toBe('16px')
    expect(rule('.dsh-agy-account-action').width).toBe('28px')
    for (const name of ['info', 'mail', 'email-text']) expect(Number.parseFloat(rule('.dsh-agy-account-' + name).minWidth)).toBe(0)
    expect(rule('.dsh-agy-account-mail').padding).toBe('0px')
    expect(SETTINGS_CSS.split('.dsh-agy-account-mail {')).toHaveLength(2)
    expect(SETTINGS_CSS).not.toContain('.dsh-agy-account.is-active {')
    expect(SETTINGS_CSS).not.toContain('.dsh-agy-account:hover {')
    const wide = SETTINGS_CSS.slice(SETTINGS_CSS.indexOf('@container agy-accounts (min-width: 440px)'))
    expect(wide).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(wide).toContain('grid-template-rows: auto 4px auto')
    expect(wide).toContain('--quota-label-row: 1')
    expect(wide).toContain('--quota-track-row: 2')
    expect(SETTINGS_CSS).toContain('.is-remove-btn:is(:hover, :focus-visible):not(:disabled)')
    expect(rule('.dsh-agy-btn-icon.is-remove-btn:is(:hover, :focus-visible):not(:disabled)').color).toContain('--dsw-alias-state-error-primary')
  })

  it('uses host semantic colors without fixed white text or dark surfaces', () => {
    expect(SETTINGS_CSS).toContain('var(--dsw-alias-label-primary, CanvasText)')
    expect(SETTINGS_CSS).toContain('var(--dsw-alias-bg-layer-2, Canvas)')
    expect(SETTINGS_CSS).toContain('var(--dsw-alias-border-l3, GrayText)')
    expect(SETTINGS_CSS).not.toMatch(/#ffffff|#181a1d|#16181b/)
  })
  it('defines toolbar, container layout, and visible native focus rules', () => {
    expect(SETTINGS_CSS).toContain('.dsh-agy-toolbar-row {')
    expect(SETTINGS_CSS).toContain('container-name: agy-settings')
    expect(SETTINGS_CSS).toContain('container-name: agy-accounts')
    expect(SETTINGS_CSS).toContain('@container agy-accounts (min-width: 440px)')
    expect(SETTINGS_CSS).toContain(':focus-visible')
    expect(SETTINGS_CSS).not.toMatch(/.is-compact[^}]*font-size/)
  })
})

describe('Account Redesign 07 Specifications', () => {
  it('renders identity header with 16px checkmark for active and 28px icon for inactive', async () => {
    const props = defaults()
    await render(React.createElement(AccountsTab, props))

    // Active account has checkmark inside mail button, no remove button
    const activeMail = button(t('currentAccountAria', { email: 'one@example.test' }))
    expect(activeMail.querySelector('.dsh-agy-account-check')).not.toBeNull()
    expect(activeMail.querySelector('.dsh-agy-account-check svg')).not.toBeNull()

    const accountRows = container.querySelectorAll('.dsh-agy-account')
    expect(accountRows).toHaveLength(2)

    // Inactive account row (second row) has remove button with 28px class and trash SVG
    const removeBtn = accountRows[1].querySelector('button.is-remove-btn') as HTMLButtonElement
    expect(removeBtn).not.toBeNull()
    expect(removeBtn.getAttribute('aria-label')).toBe('Remove two@example.test')
    expect(removeBtn.title).toBe('Remove')
    expect(removeBtn.querySelector('svg')).not.toBeNull()

    // Active account row has no remove button
    expect(accountRows[0].querySelector('button.is-remove-btn')).toBeNull()
  })

  it('renders quota tracks in 2 separate columns with period labels and full-width tracks', async () => {
    const props = defaults({
      quotas: {
        one: {
          accountId: 'one', ok: true,
          groups: [{ displayName: 'Gemini', buckets: [
            { bucketId: '5h', window: '5h', remainingFraction: .75, resetTime: new Date(Date.now() + 7200000).toISOString() },
            { bucketId: 'weekly', window: 'weekly', remainingFraction: .40, resetTime: new Date(Date.now() + 86400000).toISOString() },
          ] }]
        }
      }
    })
    await render(React.createElement(AccountsTab, props))

    const activeRow = container.querySelectorAll('.dsh-agy-account')[0]
    const quotaCols = activeRow.querySelectorAll('.dsh-agy-quota-col')
    expect(quotaCols).toHaveLength(2)

    // Column 1: 5h
    const col5h = quotaCols[0]
    expect(col5h.querySelector('.dsh-agy-quota-period')?.textContent).toBe('5h')
    expect(col5h.querySelector('.dsh-agy-quota-pct')?.textContent).toBe('75%')
    const track5h = col5h.querySelector('.dsh-agy-quota-track')
    expect(track5h).not.toBeNull()
    expect(track5h?.getAttribute('aria-valuenow')).toBe('75')
    expect(col5h.querySelector('.dsh-agy-quota-reset')?.textContent).toContain('Resets in')

    // Column 2: Weekly
    const colWeekly = quotaCols[1]
    expect(colWeekly.querySelector('.dsh-agy-quota-period')?.textContent).toBe('Weekly')
    expect(colWeekly.querySelector('.dsh-agy-quota-pct')?.textContent).toBe('40%')
    const trackWeekly = colWeekly.querySelector('.dsh-agy-quota-track')
    expect(trackWeekly).not.toBeNull()
    expect(trackWeekly?.getAttribute('aria-valuenow')).toBe('40')
    expect(colWeekly.querySelector('.dsh-agy-quota-reset')?.textContent).toContain('Resets in')
  })

  it('formats Chinese reset phrase cleanly without English unit fragments', async () => {
    const props = defaults({
      language: 'zh',
      t: translate('zh'),
      quotas: {
        one: {
          accountId: 'one', ok: true,
          groups: [{ displayName: 'Gemini', buckets: [
            { bucketId: '5h', window: '5h', remainingFraction: .8, resetTime: new Date(Date.now() + 5400000).toISOString() },
            { bucketId: 'weekly', window: 'weekly', remainingFraction: .5, resetTime: new Date(Date.now() + 90000000).toISOString() },
          ] }]
        }
      }
    })
    await render(React.createElement(AccountsTab, props))

    const activeRow = container.querySelectorAll('.dsh-agy-account')[0]
    const resets = Array.from(activeRow.querySelectorAll('.dsh-agy-quota-reset')).map(el => el.textContent)

    // Must contain Chinese units '小时', '分' or '天' and '后重置'
    expect(resets[0]).toMatch(/\d+小时.*后重置/)
    expect(resets[1]).toMatch(/\d+天.*后重置/)
    // Must NOT contain English 'h' or 'm' as units in Chinese mode
    expect(resets[0]).not.toMatch(/\d+h/)
    expect(resets[0]).not.toMatch(/\d+m/)
  })
})
