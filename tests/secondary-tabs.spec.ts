// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, createElement, isValidElement, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AdvancedTab, type AdvancedTabProps } from '../src/client/tabs/AdvancedTab.tsx'
import { Web2ApiTab, type Web2ApiTabProps } from '../src/client/tabs/Web2ApiTab.tsx'
import { NetworkTab } from '../src/client/tabs/NetworkTab.tsx'
import { en, type AntigravityKey } from '../src/client/locales.ts'

// Source/tree evidence only. These tests do not mount DOM or prove keyboard behavior.
type Node = { type: unknown, props: Record<string, any>, parents: Node[] }
function nodes(tree: ReactNode, parents: Node[] = []): Node[] {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, parents))
  if (!isValidElement<Record<string, any>>(tree)) return []
  const node = { type: tree.type, props: tree.props, parents }
  return [node, ...nodes(tree.props.children, [...parents, node])]
}
function text(tree: ReactNode): string {
  if (Array.isArray(tree)) return tree.map(text).join(' ')
  if (isValidElement<{ children?: ReactNode }>(tree)) return text(tree.props.children)
  return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : ''
}
const t = (key: AntigravityKey, params?: Record<string, unknown>) => {
  let value: string = en[key]
  for (const [name, replacement] of Object.entries(params ?? {})) value = value.replace('{' + name + '}', String(replacement))
  return value
}
const advanced = (): AdvancedTabProps => ({
  t, advancedEffort: 'medium', setAdvancedEffort: vi.fn(), advancedContextWindow: 262144,
  setAdvancedContextWindow: vi.fn(), advancedStrategy: 'proactive_threshold', setAdvancedStrategy: vi.fn(),
  advancedThreshold: 25, setAdvancedThreshold: vi.fn(), savingAdvanced: false, saveAdvanced: vi.fn(),
})
const web = (): Web2ApiTabProps => ({
  t, guideDismissed: false, dismissGuide: vi.fn(), restoreGuide: vi.fn(), dockerCmd: 'docker run fixture',
  copiedDocker: false, copyDockerCommand: vi.fn(), web2apiDetecting: false, detectLocalGateway: vi.fn(),
  web2apiEnabled: true, setWeb2apiEnabled: vi.fn(), web2apiSaving: false,
  web2apiBaseUrl: 'http://fixture/v1', setWeb2apiBaseUrl: vi.fn(), web2apiApiKey: '', setWeb2apiApiKey: vi.fn(),
  web2apiImageTool: false, setWeb2apiImageTool: vi.fn(), saveWeb2Api: vi.fn(), web2apiTesting: false,
  testWeb2Api: vi.fn(), web2apiFeedback: null,
})
function button(tree: ReactNode, label: string) {
  const result = nodes(tree).find(n => n.type === 'button' && text(n.props.children) === label)
  expect(result, label).toBeDefined()
  return result!
}

describe('Secondary tab source/tree contracts (not rendered acceptance)', () => {
  it('uses labeled native radios with exact values and selection callbacks', () => {
    const p = advanced()
    const all = nodes(AdvancedTab(p))
    for (const [name, values, callback] of [
      ['agy-effort', ['low', 'medium', 'high'], p.setAdvancedEffort],
      ['agy-context', [131072, 262144, 524288, 1048576], p.setAdvancedContextWindow],
      ['agy-strategy', ['failover_429', 'proactive_threshold', 'round_robin', 'manual'], p.setAdvancedStrategy],
    ] as const) {
      const radios = all.filter(n => n.type === 'input' && n.props.name === name)
      expect(radios.map(n => n.props.value)).toEqual(values)
      expect(radios.filter(n => n.props.checked)).toHaveLength(1)
      for (const radio of radios) {
        expect(radio.props.type).toBe('radio')
        expect(radio.parents.some(n => n.type === 'label' && text(n.props.children).trim())).toBe(true)
        radio.props.onChange()
        expect(callback).toHaveBeenLastCalledWith(radio.props.value)
      }
    }
    expect(all.some(n => n.props.role === 'radio')).toBe(false)
  })

  it('keeps the threshold outside strategy controls and forwards numeric changes', () => {
    const p = advanced()
    const tree = AdvancedTab(p)
    const range = nodes(tree).find(n => n.props.type === 'range')!
    expect([range.props.min, range.props.max, range.props.step]).toEqual(['10', '40', '5'])
    expect(range.parents.some(n => n.props.onClick || n.props.role === 'radio')).toBe(false)
    expect(range.parents.filter(n => n.type === 'label')).toHaveLength(1)
    range.props.onChange({ target: { value: '40' } })
    expect(p.setAdvancedThreshold).toHaveBeenCalledExactlyOnceWith(40)
    button(tree, en.saveAdvanced).props.onClick()
    expect(p.saveAdvanced).toHaveBeenCalledOnce()
    expect(nodes(AdvancedTab({ ...p, advancedStrategy: 'manual' })).some(n => n.props.type === 'range')).toBe(false)
    const busy = nodes(AdvancedTab({ ...p, savingAdvanced: true }))
    expect(busy.filter(n => n.type === 'fieldset').every(n => n.props.disabled)).toBe(true)
    expect(busy.filter(n => n.type === 'button' || n.props.type === 'range').every(n => n.props.disabled)).toBe(true)
  })

  it('preserves disable then Save and feedback through a controlled prop update', () => {
    const p = web()
    const checkbox = nodes(Web2ApiTab(p)).find(n => n.props.type === 'checkbox')!
    checkbox.props.onChange({ target: { checked: false } })
    expect(p.setWeb2apiEnabled).toHaveBeenCalledExactlyOnceWith(false)
    const tree = Web2ApiTab({ ...p, web2apiEnabled: false, web2apiFeedback: { ok: false, msg: 'Fixture save failed' } })
    const save = button(tree, en.web2apiSave)
    expect(save.props.disabled).toBe(false)
    save.props.onClick()
    expect(p.saveWeb2Api).toHaveBeenCalledOnce()
    expect(nodes(tree).find(n => n.props.role === 'alert')?.props.className).toContain('is-error')
    expect(nodes(tree).some(n => n.props.type === 'password')).toBe(false)
    // Persistence through Settings/API and reload needs rendered fixture coverage.
  })

  it('associates URL and password labels and preserves presets, key, image, Test, and Save', () => {
    const p = web()
    const tree = Web2ApiTab(p)
    const inputs = nodes(tree).filter(n => n.type === 'input')
    for (const input of inputs) expect(input.parents.some(n => n.type === 'label')).toBe(true)
    const url = inputs.find(n => n.props.type === 'text')!
    url.props.onChange({ target: { value: 'http://fixture-new/v1' } })
    expect(p.setWeb2apiBaseUrl).toHaveBeenLastCalledWith('http://fixture-new/v1')
    inputs.find(n => n.props.type === 'password')!.props.onChange({ target: { value: 'fixture-only' } })
    expect(p.setWeb2apiApiKey).toHaveBeenCalledExactlyOnceWith('fixture-only')
    inputs.filter(n => n.props.type === 'checkbox')[1].props.onChange({ target: { checked: true } })
    expect(p.setWeb2apiImageTool).toHaveBeenCalledExactlyOnceWith(true)
    button(tree, en.presetLocal).props.onClick()
    expect(p.setWeb2apiBaseUrl).toHaveBeenLastCalledWith('http://127.0.0.1:18088/v1')
    button(tree, en.presetDocker).props.onClick()
    expect(p.setWeb2apiBaseUrl).toHaveBeenLastCalledWith('http://localhost:18088/v1')
    button(tree, en.web2apiTest).props.onClick()
    expect(p.testWeb2Api).toHaveBeenCalledOnce()
  })

  it('keeps guide recovery, Docker copy, detection and busy states', () => {
    const p = web()
    const tree = Web2ApiTab(p)
    nodes(tree).find(n => n.props['aria-label'] === en.hideGuide)!.props.onClick()
    expect(p.dismissGuide).toHaveBeenCalledOnce()
    button(Web2ApiTab({ ...p, guideDismissed: true }), en.showGuide).props.onClick()
    expect(p.restoreGuide).toHaveBeenCalledOnce()
    button(tree, en.copyCommand).props.onClick()
    expect(p.copyDockerCommand).toHaveBeenCalledOnce()
    button(tree, en.detectService).props.onClick()
    expect(p.detectLocalGateway).toHaveBeenCalledOnce()
    expect(text(Web2ApiTab({ ...p, copiedDocker: true }))).toContain(en.copied)
    for (const busy of [{ web2apiSaving: true }, { web2apiTesting: true }, { web2apiDetecting: true }]) {
      const state = Web2ApiTab({ ...p, ...busy })
      expect(nodes(state).filter(n => n.type === 'input' || n.props.className === 'dsh-agy-chip').every(n => n.props.disabled)).toBe(true)
      expect(button(state, busy.web2apiSaving ? en.working : en.web2apiSave).props.disabled).toBe(true)
    }
  })

  it('preserves Network modes, URL edits, effective route, Save and optional error semantics', () => {
    const p = { t, network: { mode: 'proxy' as const, url: 'http://fixture', effective: 'fixture route' },
      setNetwork: vi.fn(), savingNetwork: false, saveNetwork: vi.fn(), networkMessage: 'Fixture result' }
    const tree = NetworkTab(p)
    expect(nodes(tree).filter(n => n.type === 'option').map(n => n.props.value)).toEqual(['auto', 'direct', 'proxy'])
    const select = nodes(tree).find(n => n.type === 'select')!
    select.props.onChange({ target: { value: 'direct' } })
    expect(p.setNetwork).toHaveBeenLastCalledWith({ ...p.network, mode: 'direct' })
    nodes(tree).find(n => n.type === 'input')!.props.onChange({ target: { value: 'http://new-fixture' } })
    expect(p.setNetwork).toHaveBeenLastCalledWith({ ...p.network, url: 'http://new-fixture' })
    button(tree, en.saveNetwork).props.onClick()
    expect(p.saveNetwork).toHaveBeenCalledOnce()
    expect(text(tree)).toContain('fixture route')
    expect(nodes(tree).find(n => n.props.role === 'status')?.props.className).toContain('is-success')
    expect(nodes(NetworkTab({ ...p, networkError: true })).find(n => n.props.role === 'alert')?.props.className).toContain('is-error')
    const busy = nodes(NetworkTab({ ...p, savingNetwork: true }))
    expect(busy.filter(n => ['button', 'select', 'input'].includes(String(n.type))).every(n => n.props.disabled)).toBe(true)
    expect(NetworkTab({ ...p, network: undefined })).toBeNull()
  })

  it('contains no inline foreground/background colors or redundant card labels', () => {
    for (const tree of [AdvancedTab(advanced()), Web2ApiTab(web()), NetworkTab({ t, network: { mode: 'proxy', url: '', effective: '' }, setNetwork: vi.fn(), savingNetwork: false, saveNetwork: vi.fn(), networkMessage: '' })]) {
      for (const node of nodes(tree)) {
        expect(node.props.style?.color).toBeUndefined()
        expect(node.props.style?.background).toBeUndefined()
        expect(node.props.style?.accentColor).toBeUndefined()
      }
    }
    expect(text(Web2ApiTab(web()))).not.toContain(en.statusConnected)
    expect(text(NetworkTab({ t, network: { mode: 'auto', url: '', effective: '' }, setNetwork: vi.fn(), savingNetwork: false, saveNetwork: vi.fn(), networkMessage: '' })).split(en.network)).toHaveLength(2)
  })
})

// Happy DOM mounts real elements, but does not implement native radio arrow-key defaults.
// Browser keyboard, computed layout/theme, and persistence acceptance remain separate.
let root: Root | undefined
let container: HTMLDivElement | undefined
function mount(element: ReactNode) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const host = document.createElement('div')
  container = host
  document.body.append(host)
  root = createRoot(host)
  act(() => root!.render(element))
  return host
}
afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = undefined
  container = undefined
})
function domButton(host: HTMLElement, label: string) {
  const result = Array.from(host.querySelectorAll('button')).find(b => (b.getAttribute('aria-label') ?? b.textContent) === label)
  expect(result, label).toBeDefined()
  return result!
}

describe('Secondary tabs mounted DOM fixtures (not real-browser acceptance)', () => {
  it('changes native radio selection through labels and keeps the slider separate', () => {
    const p = advanced()
    function Fixture() {
      const [effort, setEffort] = useState(p.advancedEffort)
      const [context, setContext] = useState(p.advancedContextWindow)
      const [strategy, setStrategy] = useState(p.advancedStrategy)
      return createElement(AdvancedTab, { ...p, advancedEffort: effort, advancedContextWindow: context, advancedStrategy: strategy,
        setAdvancedEffort: (value: AdvancedTabProps['advancedEffort']) => { p.setAdvancedEffort(value); setEffort(value) },
        setAdvancedContextWindow: (value: number) => { p.setAdvancedContextWindow(value); setContext(value) },
        setAdvancedStrategy: (value: AdvancedTabProps['advancedStrategy']) => { p.setAdvancedStrategy(value); setStrategy(value) } })
    }
    const host = mount(createElement(Fixture))
    for (const [name, value, callback] of [
      ['agy-effort', 'high', p.setAdvancedEffort],
      ['agy-context', '1048576', p.setAdvancedContextWindow],
      ['agy-strategy', 'manual', p.setAdvancedStrategy],
    ] as const) {
      const input = host.querySelector<HTMLInputElement>('input[name="' + name + '"][value="' + value + '"]')!
      expect(input.labels?.length).toBe(1)
      act(() => input.labels![0].click())
      expect(input.checked).toBe(true)
      expect(callback).toHaveBeenCalledTimes(1)
      input.focus()
      expect(document.activeElement).toBe(input)
      expect(input.disabled).toBe(false)
    }
    expect(p.setAdvancedContextWindow).toHaveBeenCalledWith(1048576)
    expect(host.querySelector('input[type="range"]')).toBeNull()
    const proactive = host.querySelector<HTMLInputElement>('input[value="proactive_threshold"]')!
    act(() => proactive.click())
    const range = host.querySelector<HTMLInputElement>('input[type="range"]')!
    expect([range.min, range.max, range.step]).toEqual(['10', '40', '5'])
    expect(range.closest('label')?.querySelector('input[type="radio"]')).toBeNull()
    act(() => domButton(host, en.saveAdvanced).click())
    expect(p.saveAdvanced).toHaveBeenCalledTimes(1)
  })

  it('disables Web2API then saves false and displays feedback with guide recovery', () => {
    const p = web()
    const persist = vi.fn()
    function Fixture() {
      const [enabled, setEnabled] = useState(true)
      const [dismissed, setDismissed] = useState(false)
      const [feedback, setFeedback] = useState<Web2ApiTabProps['web2apiFeedback']>(null)
      return createElement(Web2ApiTab, { ...p, web2apiEnabled: enabled, setWeb2apiEnabled: setEnabled,
        guideDismissed: dismissed, dismissGuide: () => setDismissed(true), restoreGuide: () => setDismissed(false),
        web2apiFeedback: feedback, saveWeb2Api: () => { persist({ enabled }); setFeedback({ ok: true, msg: 'Fixture saved' }) } })
    }
    const host = mount(createElement(Fixture))
    const enable = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    expect(enable.labels?.[0].textContent).toContain(en.web2apiEnable)
    act(() => enable.click())
    expect(enable.checked).toBe(false)
    const save = domButton(host, en.web2apiSave)
    expect(save.disabled).toBe(false)
    act(() => save.click())
    expect(persist).toHaveBeenCalledExactlyOnceWith({ enabled: false })
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Fixture saved')
    expect(host.querySelector('input[type="password"]')).toBeNull()
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="' + en.hideGuide + '"]')!.click())
    expect(host.querySelector('code')).toBeNull()
    act(() => domButton(host, en.showGuide).click())
    expect(host.querySelector('code')?.textContent).toBe('docker run fixture')
  })

  it('blocks busy Web2API actions and associates URL/password labels', () => {
    const p = web()
    const host = mount(createElement(Web2ApiTab, { ...p, web2apiSaving: true, web2apiFeedback: { ok: false, msg: 'Fixture failure' } }))
    for (const input of Array.from(host.querySelectorAll<HTMLInputElement>('input'))) {
      expect(input.labels?.length).toBe(1)
      expect(input.disabled).toBe(true)
    }
    act(() => domButton(host, en.working).click())
    act(() => domButton(host, en.presetLocal).click())
    act(() => domButton(host, en.detectService).click())
    expect(p.saveWeb2Api).not.toHaveBeenCalled()
    expect(p.setWeb2apiBaseUrl).not.toHaveBeenCalled()
    expect(p.detectLocalGateway).not.toHaveBeenCalled()
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Fixture failure')
  })

  it('switches Network mode and shows failed-save feedback without success styling', () => {
    const save = vi.fn()
    function Fixture() {
      const [network, setNetwork] = useState({ mode: 'direct' as 'auto' | 'direct' | 'proxy', url: 'http://fixture', effective: 'fixture route' })
      const [failed, setFailed] = useState(false)
      return createElement(NetworkTab, { t, network, setNetwork, savingNetwork: false,
        saveNetwork: () => { save(network); setFailed(true) }, networkMessage: failed ? 'Fixture rejected' : '', networkError: failed })
    }
    const host = mount(createElement(Fixture))
    const select = host.querySelector('select')!
    expect(select.labels?.length).toBe(1)
    act(() => { select.value = 'proxy'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(host.querySelector<HTMLInputElement>('input')?.value).toBe('http://fixture')
    expect(host.querySelector('input')?.labels?.length).toBe(1)
    act(() => domButton(host, en.saveNetwork).click())
    expect(save).toHaveBeenCalledExactlyOnceWith({ mode: 'proxy', url: 'http://fixture', effective: 'fixture route' })
    const alert = host.querySelector('[role="alert"]')!
    expect(alert.textContent).toBe('Fixture rejected')
    expect(alert.className).toContain('is-error')
    expect(alert.className).not.toContain('is-success')
  })
})
