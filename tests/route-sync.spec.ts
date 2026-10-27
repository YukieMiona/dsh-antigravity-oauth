import type { AdapterRegistrationHandle } from '@deepseek-ai/dsh-llm'
import { describe, expect, it } from 'vitest'
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

  it('still surfaces other replace failures', async () => {
    await expect(syncAuthenticatedRoute(session(true), handle(() => {
      throw new Error('duplicate')
    }))).rejects.toThrow('duplicate')
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
