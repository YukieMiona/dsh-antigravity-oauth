import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { AdapterRegistrationHandle } from '@deepseek-ai/dsh-llm'
import { createAntigravityAdapter } from './adapter.ts'
import { registerAntigravityAuthRoutes } from './auth-routes.ts'
import { HARNESS_ROUTE, OAUTH_REFRESH_POLL_MS, WEB2API_ROUTE } from './ids.ts'
import { Web2ApiAdapter } from './web2api/adapter.ts'
import { maskDshWebAssembly } from './native-tools.ts'
import type { Config } from './plugin-config.ts'
import { AntigravitySession } from './session.ts'
import { AntigravityCredentialStore } from './store.ts'
import { envProxyFetch } from './proxy-fetch.ts'
import { ensureAntigravityVersion } from './user-agent.ts'

type NativeAssembly = {
  tools: { name: string }[]
  sections: { name: string, text: string }[]
}

type NativeAssembleContext = {
  agent?: { options?: { provider?: string } }
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    'system-prompt/assemble'(
      assembly: NativeAssembly,
      context: NativeAssembleContext,
      next: () => Promise<NativeAssembly>,
    ): Promise<NativeAssembly>
  }
}

export { createAntigravityAdapter } from './adapter.ts'
export { Web2ApiAdapter, WEB2API_ROUTE } from './web2api/adapter.ts'
export {
  registerAntigravityAuthRoutes,
} from './auth-routes.ts'
export { AUTH_COMPLETE_PATH, AUTH_LOGIN_PATH, AUTH_LOGOUT_PATH, AUTH_STATUS_PATH, AUTH_FILENAME, BOOT_MARKER, HARNESS_ROUTE } from './ids.ts'
export { Config } from './plugin-config.ts'
export type { Config as PluginConfig } from './plugin-config.ts'
export { AntigravitySession } from './session.ts'
export { AntigravityCredentialStore, antigravityAuthPath } from './store.ts'
export { authorizationUrl, LOAD_CODE_ASSIST_BODY, SCOPES } from './oauth.ts'
export { buildCcaBody, createCcaSession, streamGenerateContentUrl } from './envelope.ts'
export {
  appendContinueMemo,
  appendSearchDossier,
  appendSearchMemo,
  appendSearchTurns,
  SEARCH_ANSWER_GUIDANCE,
  SEARCH_CONTINUE_GUIDANCE,
  SEARCH_FOLLOW_UP_LIMIT,
  THOUGHT_ONLY_CONTINUE,
  withoutSearchWeb,
} from './search-turn.ts'
export { CcaClient } from './cca-client.ts'
export type { AntigravityOAuth, CcaKind, CcaSession } from './types.ts'

export const name = 'llm-antigravity-oauth'
export const inject = ['llm', 'webServer']

function isDisposedRegistration(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'REGISTRATION_DISPOSED'
}

export async function syncAuthenticatedRoute(
  session: AntigravitySession,
  registration: AdapterRegistrationHandle,
  web2apiRegistration?: AdapterRegistrationHandle,
): Promise<void> {
  try {
    registration.replace(await session.hasReadyAccount() ? [HARNESS_ROUTE] : [])
    if (web2apiRegistration) {
      const webSettings = await session.web2api.read()
      web2apiRegistration.replace(webSettings.enabled ? [WEB2API_ROUTE] : [])
    }
  } catch (error) {
    // A short command such as `dsh web --help` disposes the fiber before this
    // async refresh runs. Replacing routes after that is not a load failure.
    if (isDisposedRegistration(error)) return
    throw error
  }
}

export function apply(ctx: Context, config: Config): void {
  console.log('[my-plugins/dsh-antigravity-oauth] loaded')
  const session = new AntigravitySession(new AntigravityCredentialStore())
  const registration = ctx.llm.registerAdapter(
    [HARNESS_ROUTE],
    createAntigravityAdapter(session, {
      nativeTools: config.nativeTools !== false,
      nativeSearch: config.nativeSearch !== false,
      streamIdleTimeoutMs: config.streamIdleTimeoutMs,
      resolveAttachments: () => ctx.get('attachments'),
    }),
  )
  const web2apiAdapter = new Web2ApiAdapter(() => session.web2api.read())
  const web2apiRegistration = ctx.llm.registerAdapter([WEB2API_ROUTE], web2apiAdapter)
  const refreshRoutes = (): Promise<void> => syncAuthenticatedRoute(session, registration, web2apiRegistration)
  void refreshRoutes()
  void ensureAntigravityVersion(envProxyFetch)
  ctx.effect(() => {
    const timer = setInterval(() => {
      void session.refreshIfNeeded().catch(() => { /* next poll retries */ })
    }, OAUTH_REFRESH_POLL_MS)
    void session.refreshIfNeeded().catch(() => { /* next poll retries */ })
    return () => clearInterval(timer)
  }, 'dsh-antigravity-oauth: refresh oauth grant')
  ctx.inject(['webServer'], webCtx => {
    registerAntigravityAuthRoutes(webCtx, session, { onAuthChanged: refreshRoutes })
  })
  if (config.nativeTools !== false) {
    ctx.inject(['systemPrompt'], promptCtx => {
      promptCtx.on('system-prompt/assemble', async (_assembly, context, next) => {
        const assembled = await next()
        return context.agent?.options?.provider === HARNESS_ROUTE
          ? maskDshWebAssembly(assembled)
          : assembled
      })
    })
  }
}
