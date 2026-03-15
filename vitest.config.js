import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    clearMocks: true,
    coverage: {
      enabled: true,
      include: ['*.js'],
      exclude: ['vitest.config.js'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
    },
    restoreMocks: true,
    sequence: {
      shuffle: true,
    },
  },
})
