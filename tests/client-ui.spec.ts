// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AccountsTab, type AccountsTabProps } from '../src/client/tabs/AccountsTab.tsx'
import { AntigravitySettings } from '../src/client/Settings.tsx'
import { SETTINGS_CSS } from '../src/client/theme.ts'
import { en, zh, type AntigravityKey } from '../src/client/locales.ts'
import type { AccountQuotaSummary, AccountSummary } from '../src/types.ts'

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
function button(text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find(el => el.textContent?.trim() === text)
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
    await click(button(en.removeAccount))
    expect(props.removeAccount).toHaveBeenCalledExactlyOnceWith('two')
    expect(props.switchAccount).not.toHaveBeenCalled()
    expect(button('one@example.test').getAttribute('aria-pressed')).toBe('true')
    expect(button('one@example.test').disabled).toBe(true)
  })
  it.each([{ busy: true }, { switchingId: 'one' }])('blocks native account actions while %o', async state => {
    const props = defaults(state)
    await render(React.createElement(AccountsTab, props))
    for (const el of [button('two@example.test'), button(en.removeAccount)]) {
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
    expect(container.textContent).toContain(language === 'zh' ? '已刷新' : 'Refreshed')
    await render(React.createElement(AccountsTab, defaults({ language, quotas: {} })))
    expect(container.querySelector('.dsh-agy-capsule-reset')).toBeNull()
  })
  it('keeps typography stable when density changes in the DOM CSS engine', async () => {
    // happy-dom does not implement browser layout, container queries, or physical zoom.
    const style = document.createElement('style')
    style.textContent = SETTINGS_CSS
    document.head.append(style)
    await render(React.createElement(AccountsTab, defaults()))
    const normal = getComputedStyle(button('two@example.test')).fontSize
    const reset = getComputedStyle(container.querySelector('.dsh-agy-capsule-reset')!).fontSize
    expect(normal).toBe('13px')
    expect(reset).toBe('10px')
    await render(React.createElement(AccountsTab, defaults({ compactView: true })))
    expect(getComputedStyle(button('two@example.test')).fontSize).toBe(normal)
    expect(getComputedStyle(container.querySelector('.dsh-agy-capsule-reset')!).fontSize).toBe(reset)
    expect(container.querySelectorAll('.dsh-agy-account.is-compact')).toHaveLength(2)
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
    expect(button('two@example.test').getAttribute('aria-pressed')).toBe('true')
    expect(button(en.addAccount).disabled).toBe(false)
  })
  it('preserves the active identity after a failed switch', async () => {
    stubSettings((path, init) => path.includes('/accounts/switch') && init?.method === 'POST'
      ? Promise.resolve(new Response(JSON.stringify({ error: 'Fixture switch failed' }), { status: 500 })) : undefined)
    await render(React.createElement(AntigravitySettings, { t }))
    await click(button('two@example.test'))
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Fixture switch failed')
    expect(button('one@example.test').getAttribute('aria-pressed')).toBe('true')
    expect(button('two@example.test').disabled).toBe(false)
  })
})

describe('Theme source contracts, not browser layout proof', () => {
  it('uses host semantic colors without fixed white text or dark surfaces', () => {
    expect(SETTINGS_CSS).toContain('var(--dsw-alias-label-primary, CanvasText)')
    expect(SETTINGS_CSS).toContain('var(--dsw-alias-bg-layer-2, Canvas)')
    expect(SETTINGS_CSS).toContain('var(--dsw-alias-border-l3, GrayText)')
    expect(SETTINGS_CSS).not.toMatch(/#ffffff|#181a1d|#16181b/)
  })
  it('defines toolbar, container layout, and visible native focus rules', () => {
    expect(SETTINGS_CSS).toContain('.dsh-agy-toolbar-row {')
    expect(SETTINGS_CSS).toContain('container-name: agy-settings')
    expect(SETTINGS_CSS).toContain('@container agy-settings (min-width: 640px)')
    expect(SETTINGS_CSS).toContain('@container agy-settings (max-width: 439px)')
    expect(SETTINGS_CSS).toContain(':focus-visible')
    expect(SETTINGS_CSS).not.toMatch(/.is-compact[^}]*font-size/)
  })
})
