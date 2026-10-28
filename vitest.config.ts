import { defineConfig } from 'vitest/config'

// The Host can supply NODE_ENV=production. DOM tests require React test behavior.
process.env.NODE_ENV = 'test'

export default defineConfig({
  test: {
    // OAuth callback integration suites share the registered port 51121.
    fileParallelism: false,
    include: ['tests/**/*.spec.ts'],
  },
})
