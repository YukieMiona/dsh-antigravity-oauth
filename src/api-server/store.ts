import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { API_SERVER_FILENAME, DEFAULT_API_SERVER_HOST, DEFAULT_API_SERVER_PORT } from '../ids.ts'
import {
  DEFAULT_API_SERVER_SETTINGS,
  type ApiServerSettings,
} from './types.ts'

export function generateApiKey(): string {
  return `sk-agy-${randomBytes(16).toString('hex')}`
}

export function sanitizeApiServerSettings(raw: unknown): ApiServerSettings {
  if (typeof raw !== 'object' || raw === null) {
    return {
      ...DEFAULT_API_SERVER_SETTINGS,
      apiKey: generateApiKey(),
    }
  }
  const data = raw as Record<string, unknown>
  const enabled = Boolean(data.enabled)
  const host = typeof data.host === 'string' && data.host.trim().length > 0
    ? data.host.trim()
    : DEFAULT_API_SERVER_HOST
  const rawPort = Number(data.port)
  const port = Number.isInteger(rawPort) && rawPort >= 1024 && rawPort <= 65535
    ? rawPort
    : DEFAULT_API_SERVER_PORT
  const apiKey = typeof data.apiKey === 'string' && data.apiKey.trim().length > 0
    ? data.apiKey.trim()
    : generateApiKey()

  return { enabled, host, port, apiKey }
}

export class AntigravityApiServerStore {
  constructor(readonly filename: string) {}

  async read(): Promise<ApiServerSettings> {
    try {
      const text = await readFile(this.filename, 'utf-8')
      return sanitizeApiServerSettings(JSON.parse(text))
    } catch {
      return sanitizeApiServerSettings(null)
    }
  }

  async save(settings: unknown): Promise<ApiServerSettings> {
    const sanitized = sanitizeApiServerSettings(settings)
    await writeFileAtomic(this.filename, JSON.stringify(sanitized, null, 2) + '\n', { mode: 0o600, dirMode: 0o700 })
    return sanitized
  }
}

export function defaultApiServerPath(dshHome?: string): string {
  return resolve(join(resolveDshHome(dshHome), API_SERVER_FILENAME))
}
