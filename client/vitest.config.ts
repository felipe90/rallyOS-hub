import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const isCoverage = process.env.VITEST_COVERAGE === '1'

const baseExclude = [
  'node_modules/',
  'src/test/',
  '**/*.d.ts',
  '**/*.config.*',
  '**/mockData',
  '**/dist',
  'src/server/**',
]

// App.test.tsx imports the full App tree and OOMs under v8 coverage
// on GitHub Actions 7GB runners. Exclude it from coverage runs.
const testExclude = isCoverage
  ? [...baseExclude, 'src/__tests__/App.test.tsx']
  : baseExclude

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: ['..'], // allow importing from shared/ at the repo root
    },
  },
  define: {
    'import.meta.env.VITE_ENCRYPTION_SECRET': JSON.stringify('0123456789abcdef0123456789abcdef'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', '../shared/__tests__/*.test.ts'],
    exclude: testExclude,
    poolOptions: {
      forks: {
        ...(isCoverage ? { singleFork: true } : {}),
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/dist',
        'src/server/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
})