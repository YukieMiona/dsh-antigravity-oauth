import { describe, expect, it } from 'vitest'
import { createAntigravityAdapter } from '../src/adapter.ts'
import { DEFAULT_ENABLED_MODELS, PUBLIC_MODELS } from '../src/models.ts'
import type { AntigravitySession } from '../src/session.ts'

describe('Enabled models filtering', () => {
  it('defaults to only gemini-3.8-flash in DEFAULT_ENABLED_MODELS', () => {
    expect(DEFAULT_ENABLED_MODELS).toEqual(['gemini-3.8-flash'])
  })

  it('filters listModels by session enabledModels', async () => {
    let currentEnabled = ['gemini-3.8-flash']
    const fakeSession = {
      thoughtSignatures: new Map(),
      getAdvancedSettings: async () => ({
        enabledModels: currentEnabled,
        defaultReasoningEffort: 'medium',
      }),
    } as unknown as AntigravitySession

    const adapter = createAntigravityAdapter(fakeSession, {
      nativeTools: true,
      nativeSearch: true,
    })

    // Initially only 3.8-flash
    const list1 = await adapter.listModels('agy-google-antigravity')
    expect(list1.map(m => m.id)).toEqual(['gemini-3.8-flash'])

    // User enables 4-argon as well
    currentEnabled = ['gemini-3.8-flash', 'gemini-4-argon']
    const list2 = await adapter.listModels('agy-google-antigravity')
    expect(list2.map(m => m.id)).toEqual(['gemini-4-argon', 'gemini-3.8-flash'])

    // If empty list passed, fallback to default
    currentEnabled = []
    const list3 = await adapter.listModels('agy-google-antigravity')
    expect(list3.map(m => m.id)).toEqual(['gemini-3.8-flash'])
  })
})
