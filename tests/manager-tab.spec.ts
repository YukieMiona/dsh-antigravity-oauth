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
      settings: { enabled: false, baseUrl: 'http://127.0.0.1:8045/v1', hasApiKey: true, apiKeyHint: '…4e5f' },
      enabledModels: ['gemini-3.8-flash', 'gemini-3.7-flash'],
      save: vi.fn(async () => ({ enabled: true, baseUrl: 'http://127.0.0.1:8045/v1', hasApiKey: true, apiKeyHint: '…4e5f' })),
      test: vi.fn(async () => ({
        ok: true, latencyMs: 42, gatewayUp: true, coreUp: true,
        models: ['gemini-3.8-flash-low', 'gemini-3.8-flash-medium', 'gemini-3.8-flash-high'],
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
    expect(props.save).toHaveBeenLastCalledWith({ enabled: true })
    const save = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent === en.bridgeSave)!
    await act(async () => { save.click() })
    expect(props.save).toHaveBeenLastCalledWith({ baseUrl: 'http://127.0.0.1:8045/v1' })
  })
})
