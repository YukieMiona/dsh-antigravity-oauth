import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { ACCOUNT_TOGGLE_ARGON_PATH, CALLBACK_URI, MANAGER_TEST_PATH, TOKEN_URL } from '../src/ids.ts'
import { AntigravitySession } from '../src/session.ts'
import { AntigravityCredentialStore } from '../src/store.ts'
import { authorizationUrl } from '../src/oauth.ts'
import { registerAntigravityAuthRoutes } from '../src/auth-routes.ts'

async function sessionWithStore(fetchImpl: typeof fetch): Promise<{
  session: AntigravitySession
  dir: string
}> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-agy-auth-'))
  return { dir, session: new AntigravitySession(new AntigravityCredentialStore(join(dir, 'auth.json')), fetchImpl) }
}

async function waitForCallbackPort(): Promise<void> {
  const deadline = Date.now() + 2_000
  while (Date.now() < deadline) {
    try {
      await fetch('http://127.0.0.1:51121/favicon.ico')
      return
    } catch {
      await new Promise(resolve => setTimeout(resolve, 20))
    }
  }
  throw new Error('callback server did not listen on 51121')
}

describe('AntigravitySession login URL', () => {
  it('returns a Google authorization URL without PKCE', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-agy-auth-'))
    const session = new AntigravitySession(new AntigravityCredentialStore(join(dir, 'auth.json')), async () => {
      throw new Error('network disabled')
    })
    try {
      const challenge = await session.signIn()
      expect(challenge.url).not.toContain('code_challenge')
      expect(challenge.url).not.toContain('aicode')
      expect(new URL(challenge.url).hostname).toBe('accounts.google.com')
      expect(challenge.url.startsWith(authorizationUrl(new URL(challenge.url).searchParams.get('state') ?? '').slice(0, 40))).toBe(true)
    } finally {
      await session.dispose()
    }
  })

  it('waitUntilSettled resolves after login is cancelled so route refresh can run', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-agy-auth-'))
    const session = new AntigravitySession(new AntigravityCredentialStore(join(dir, 'auth.json')), async () => {
      throw new Error('network disabled')
    })
    try {
      await session.signIn()
      const settled = session.waitUntilSettled()
      await session.dispose()
      await expect(settled).resolves.toBeUndefined()
    } finally {
      await session.dispose()
    }
  })
})

describe('AntigravitySession login after logout', () => {
  it('starts a new authorization after signOut', async () => {
    const { session } = await sessionWithStore(async () => {
      throw new Error('network disabled')
    })
    try {
      const first = await session.signIn()
      await session.signOut()
      expect(await session.snapshot()).toEqual({ status: 'signed-out', accounts: [] })
      const second = await session.signIn()
      expect(new URL(second.url).hostname).toBe('accounts.google.com')
      expect(new URL(second.url).searchParams.get('state')).not.toBe(new URL(first.url).searchParams.get('state'))
      expect((await session.snapshot()).status).toBe('signing-in')
    } finally {
      await session.dispose()
    }
  })

  it('surfaces token-exchange failure instead of falling back to signed-out', async () => {
    const { session } = await sessionWithStore(async (input) => {
      const url = String(input)
      if (url.startsWith(TOKEN_URL)) {
        return new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'code already used' }), {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
        })
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    try {
      const challenge = await session.signIn()
      await waitForCallbackPort()
      const state = new URL(challenge.url).searchParams.get('state')
      expect(state).toBeTruthy()
      const callback = fetch(`${CALLBACK_URI}?code=fake-code&state=${state}`)
      await session.waitUntilSettled()
      const page = await callback
      const snap = await session.snapshot()
      expect(snap.status).toBe('error')
      if (snap.status === 'error') {
        expect(snap.message).toMatch(/token exchange failed|invalid_grant/i)
      }
      expect(page.ok).toBe(false)
    } finally {
      await session.dispose()
    }
  })

  it('does not abort login when the browser also requests favicon', async () => {
    const { session } = await sessionWithStore(async () => {
      throw new Error('network disabled')
    })
    try {
      await session.signIn()
      await waitForCallbackPort()
      const favicon = await fetch('http://127.0.0.1:51121/favicon.ico')
      expect(favicon.status).toBe(404)
      expect((await session.snapshot()).status).toBe('signing-in')
    } finally {
      await session.dispose()
    }
  })

  it('handles ACCOUNT_TOGGLE_ARGON_PATH and MANAGER_TEST_PATH cleanly', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-agy-auth-routes-'))
    const store = new AntigravityCredentialStore(join(dir, 'auth.json'))
    await store.add({
      type: 'oauth', access: 'acc_tok', refresh: 'ref_tok', expires: Date.now() + 600000, projectId: 'p1', email: 'user@test.org',
    })
    const accounts = await store.list()
    const targetId = accounts[0]!.id

    const session = new AntigravitySession(store)
    const routes = new Map<string, (req: any, res: any) => Promise<void>>()
    const mockCtx = {
      effect: (fn: any) => fn(),
      webServer: {
        register: (def: any) => {
          routes.set(def.path, def.handler)
          return () => {}
        },
      },
    } as any

    const notify = vi.fn()
    registerAntigravityAuthRoutes(mockCtx, session, { onAuthChanged: notify })

    const mockReq = (method: string, body?: any) => {
      const jsonStr = body !== undefined ? JSON.stringify(body) : ''
      const req = Readable.from(jsonStr ? [Buffer.from(jsonStr)] : []) as any
      req.method = method
      req.socket = { remoteAddress: '127.0.0.1' }
      req.headers = { host: '127.0.0.1:3080', 'content-type': 'application/json' }
      return req
    }
    const mockRes = () => {
      let code = 200
      let raw = ''
      return {
        writeHead: (c: number) => { code = c },
        end: (d?: any) => { raw += d ? d.toString() : '' },
        get status() { return code },
        get data() { return JSON.parse(raw) },
      }
    }

    // 1. Toggle Argon on
    const toggleHandler = routes.get(ACCOUNT_TOGGLE_ARGON_PATH)!
    expect(toggleHandler).toBeDefined()

    const res1 = mockRes()
    await toggleHandler(mockReq('POST', { id: targetId }), res1)
    expect(res1.status).toBe(200)
    expect(res1.data.ok).toBe(true)
    expect(res1.data.hasArgon).toBe(true)
    expect(notify).toHaveBeenCalled()

    // Verify persisted
    const updated1 = await store.get(targetId)
    expect(updated1?.hasArgon).toBe(true)

    // 2. Toggle Argon off
    const res2 = mockRes()
    await toggleHandler(mockReq('POST', { id: targetId }), res2)
    expect(res2.status).toBe(200)
    expect(res2.data.ok).toBe(true)
    expect(res2.data.hasArgon).toBe(false)

    // 3. Manager test endpoint returns safe JSON on unreachable port
    const managerHandler = routes.get(MANAGER_TEST_PATH)!
    expect(managerHandler).toBeDefined()

    const resManager = mockRes()
    await managerHandler(mockReq('POST', { baseUrl: 'http://127.0.0.1:59999/v1', apiKey: 'sk-test' }), resManager)
    expect(resManager.status).toBe(200)
    expect(resManager.data.ok).toBe(false)
    expect(resManager.data.error).toBeDefined()
  })
})
