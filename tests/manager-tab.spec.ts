// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManagerTab } from '../src/client/tabs/ManagerTab.tsx'
import { en, type AntigravityKey } from '../src/client/locales.ts'

describe('ManagerTab', () => {
  let root: Root | undefined
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = '' })
  const t = (key: AntigravityKey, params?: Record<string, unknown>) =>
    String(en[key]).replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? ''))

  async function mount(props: Partial<Parameters<typeof ManagerTab>[0]>) {
    const host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    const full = {
      t,
      settings: { route: 'direct' as const, enabled: false, agyPath: '/root/.local/bin/agy', baseUrl: 'http://127.0.0.1:8045/v1', hasApiKey: true, apiKeyHint: '…4e5f' },
      enabledModels: ['gemini-3.8-flash', 'gemini-3.7-flash'],
      save: vi.fn(async () => ({ route: 'gateway' as const, enabled: true, agyPath: '/root/.local/bin/agy', baseUrl: 'http://127.0.0.1:8045/v1', hasApiKey: true, apiKeyHint: '…4e5f' })),
      test: vi.fn(async () => ({
        ok: true, latencyMs: 42, gatewayUp: true, coreUp: true,
        models: ['gemini-3.8-flash-low', 'gemini-3.8-flash-medium', 'gemini-3.8-flash-high'],
        agy: { installed: true, signedIn: true, models: ['gemini-3.8-flash-low', 'claude-sonnet-4-6'] },
      })),
      ...props,
    }
    await act(async () => { root!.render(createElement(ManagerTab, full)) })
    return { host, props: full }
  }

  it('probes on open, warns about models the gateway lacks, and never shows the saved key', async () => {
    const { host, props } = await mount({})
    expect(props.test).toHaveBeenCalledOnce()
    const warning = host.querySelector('.dsh-agy-callout.is-warn')?.textContent ?? ''
    expect(warning).toContain('gemini-3.7-flash')
    expect(warning).not.toContain('gemini-3.8-flash')
    expect(host.textContent).toContain('…4e5f')
    expect(host.querySelector<HTMLInputElement>('input[type="password"]')!.value).toBe('')
  })

  it('switches route immediately and sends a typed key only when present', async () => {
    const { host, props } = await mount({})
    const gateway = host.querySelector<HTMLInputElement>('input[name="agy-route"][value="gateway"]')!
    expect(host.querySelector<HTMLInputElement>('input[name="agy-route"][value="direct"]')!.checked).toBe(true)
    expect(gateway.closest('label')?.textContent).toContain(en.routeGatewayDesc)
    await act(async () => { gateway.click() })
    expect(props.save).toHaveBeenLastCalledWith({ route: 'gateway' })
    const save = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent === en.bridgeSave)!
    await act(async () => { save.click() })
    expect(props.save).toHaveBeenLastCalledWith({ baseUrl: 'http://127.0.0.1:8045/v1' })
  })
  it('offers the official CLI route and shows its sign-in state', async () => {
    const { host, props } = await mount({})
    expect(host.textContent).toContain(t('agySignedIn', { count: 2 }))
    const agy = host.querySelector<HTMLInputElement>('input[name="agy-route"][value="agy"]')!
    expect(agy.closest('label')?.textContent).toContain(en.routeAgy)
    await act(async () => { agy.click() })
    expect(props.save).toHaveBeenLastCalledWith({ route: 'agy' })
  })
})
