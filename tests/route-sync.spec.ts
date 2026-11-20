import type { AdapterRegistrationHandle } from '@deepseek-ai/dsh-llm'
import { describe, expect, it, vi } from 'vitest'
import { syncAuthenticatedRoute } from '../src/index.ts'
import type { AntigravitySession } from '../src/session.ts'

function session(ready: boolean): AntigravitySession {
  return { hasReadyAccount: async () => ready } as AntigravitySession
}

function handle(replace: () => void): AdapterRegistrationHandle {
  return { replace } as unknown as AdapterRegistrationHandle
}

describe('syncAuthenticatedRoute', () => {
  it('ignores a registration disposed before the account check settles', async () => {
    await expect(syncAuthenticatedRoute(session(false), handle(() => {
      const error = new Error('a disposed adapter registration cannot replace its routes')
      Object.assign(error, { code: 'REGISTRATION_DISPOSED' })
      throw error
    }))).resolves.toBeUndefined()
  })

  it('logs other replace failures instead of throwing, since nothing awaits this at load time', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(syncAuthenticatedRoute(session(true), handle(() => {
      throw new Error('duplicate')
    }))).resolves.toBeUndefined()
    expect(logged.mock.calls.flat().join(' ')).toContain('duplicate')
    logged.mockRestore()
  })

  it('keeps DSH running when the account file cannot be read: the Direct route stays off', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    let routes: string[] | undefined
    const unreadable = {
      hasReadyAccount: async () => { throw new Error('dsh-antigravity-oauth: auth.json is not valid JSON') },
      manager: { read: async () => ({ route: 'direct', enabled: false, baseUrl: '', apiKey: '' }) },
    } as unknown as AntigravitySession
    await expect(syncAuthenticatedRoute(unreadable, handle(((next: string[]) => { routes = next }) as () => void))).resolves.toBeUndefined()
    expect(routes).toEqual([])
    expect(logged.mock.calls.flat().join(' ')).toContain('not valid JSON')
    // On the Official CLI route the account file is not needed at all.
    const viaAgy = { ...unreadable, manager: { read: async () => ({ route: 'agy', enabled: false, baseUrl: '', apiKey: '' }) } } as unknown as AntigravitySession
    await syncAuthenticatedRoute(viaAgy, handle(((next: string[]) => { routes = next }) as () => void))
    expect(routes).toEqual(['agy-google-antigravity'])
    logged.mockRestore()
  })

  it('mounts the provider route while the bridge is on, even with no ready account', async () => {
    let routes: string[] | undefined
    const bridged = {
      hasReadyAccount: async () => false,
      manager: { read: async () => ({ enabled: true, baseUrl: 'http://127.0.0.1:8045/v1', apiKey: '' }) },
    } as unknown as AntigravitySession
    await syncAuthenticatedRoute(bridged, handle(((next: string[]) => { routes = next }) as () => void))
    expect(routes).toEqual(['agy-google-antigravity'])
  })

  it('mounts or unmounts WEB2API_ROUTE dynamically based on enabled setting', async () => {
    let replacedRoutes: string[] | undefined
    const mockWeb2ApiHandle = {
      replace: (routes: readonly string[]) => {
        replacedRoutes = [...routes]
      },
    } as unknown as AdapterRegistrationHandle

    const mockSession = (web2apiEnabled: boolean) => ({
      hasReadyAccount: async () => true,
      web2api: {
        read: async () => ({ enabled: web2apiEnabled }),
      },
    } as unknown as AntigravitySession)

    // 1. When disabled -> empty routes
    await syncAuthenticatedRoute(mockSession(false), handle(() => {}), mockWeb2ApiHandle)
    expect(replacedRoutes).toEqual([])

    // 2. When enabled -> WEB2API_ROUTE ('agy-web')
    await syncAuthenticatedRoute(mockSession(true), handle(() => {}), mockWeb2ApiHandle)
    expect(replacedRoutes).toEqual(['agy-web'])
  })
});
