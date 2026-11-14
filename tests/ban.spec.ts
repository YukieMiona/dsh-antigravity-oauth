import { describe, expect, it, vi } from 'vitest'
import { isAccountBannedError } from '../src/ban.ts'
import { AntigravitySession } from '../src/session.ts'

describe('isAccountBannedError', () => {
  it('recognises Google ToS bans and older suspension codes, not ordinary 403s', () => {
    expect(isAccountBannedError('CCA 403: {"message":"This service has been disabled in this account for violation of Terms of Service.","reason":"TOS_VIOLATION"}')).toBe(true)
    expect(isAccountBannedError('USER_SUSPENDED')).toBe(true)
    expect(isAccountBannedError('CCA 403: PERMISSION_DENIED model not available')).toBe(false)
    expect(isAccountBannedError('429 RESOURCE_EXHAUSTED')).toBe(false)
  })
})

describe('AntigravitySession.noteBanned', () => {
  it('persists bannedAt once and reports the account as banned and dead', async () => {
    const account = { id: 'a1', email: 'x@example.test', projectId: 'p', access: 't', refresh: 'r', expires: Date.now() + 60_000 }
    const stored: Record<string, unknown> = { ...account }
    const store = {
      filename: '/tmp/agy-ban-test/.auth.json',
      get: vi.fn(async () => ({ ...stored })),
      update: vi.fn(async (_id: string, patch: Record<string, unknown>) => { Object.assign(stored, patch); return { ...stored } }),
      list: vi.fn(async () => [{ ...stored }]),
      active: vi.fn(async () => ({ ...stored })),
    }
    const session = new AntigravitySession(store as never, vi.fn() as never)
    await session.noteBanned('a1')
    await session.noteBanned('a1')
    expect(store.update).toHaveBeenCalledTimes(1)
    expect(typeof stored.bannedAt).toBe('string')
    expect(await session.hasReadyAccount()).toBe(false)
  })
})
