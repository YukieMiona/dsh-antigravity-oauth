// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AntigravitySettings } from '../src/client/Settings.tsx'
import { en, type AntigravityKey } from '../src/client/locales.ts'

const t = (key: AntigravityKey, params?: Record<string, unknown>) =>
  String(en[key]).replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? ''))

const accounts = [
  { id: 'a', email: 'namidayo0v0@gmail.com', ready: true, limited: false, dead: false },
  { id: 'b', email: 'hoshiyomi0v0@gmail.com', ready: true, limited: false, dead: true, banned: true },
]

let root: Root | undefined
let host: HTMLElement | undefined
afterEach(async () => {
  await act(async () => root?.unmount())
  host?.remove()
  vi.unstubAllGlobals()
})

async function mount(route: 'direct' | 'agy') {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const path = String(input)
    let data: unknown = {}
    if (path.includes('/auth/status')) data = { status: 'signed-in', activeId: 'a', accounts }
    else if (path.includes('/manager/settings')) data = { route, enabled: false, agyPath: '/x/agy', baseUrl: 'http://x/v1', hasApiKey: false, apiKeyHint: '' }
    else if (path.includes('/accounts/quotas')) data = { ok: true, quotas: {} }
    return new Response(JSON.stringify(data), { status: 200 })
  }))
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root!.render(React.createElement(AntigravitySettings, { t })))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  return host
}

describe('route-aware header and account list', () => {
  it('hides the direct account and its check mark on the Official CLI route', async () => {
    const page = await mount('agy')
    expect(page.querySelector('.dsh-agy-header-active-badge')).toBeNull()
    expect(page.querySelector('.dsh-agy-title-row .dsh-agy-pill')?.textContent).toBe(en.routeAgy)
    expect(page.querySelector('.dsh-agy-account.is-active')).toBeNull()
    expect(page.querySelector('.dsh-agy-callout')?.textContent).toContain(en.routeAgy)
  })

  it('shows the active account and its check mark on the Direct route', async () => {
    const page = await mount('direct')
    expect(page.querySelector('.dsh-agy-header-active-badge')?.textContent).toContain('namidayo0v0@gmail.com')
    expect(page.querySelector('.dsh-agy-account.is-active .dsh-agy-account-email-text')?.textContent).toBe('namidayo0v0@gmail.com')
  })
})
