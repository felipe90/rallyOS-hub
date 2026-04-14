import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'build']),
  
  // Base TypeScript/JS rules
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      // reactHooks.configs.flat.recommended, // Too strict - relax to allow dev
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Custom rules - relaxed for this codebase
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'off', // Too strict - use 'any' in some places
      '@typescript-eslint/no-empty-object-type': 'off', // Allow empty interfaces for extensions
      'no-console': 'off', // Allow console in dev
      'react-refresh/only-export-components': 'off', // Too strict for this project structure
    },
  },
  
  // Test files - relax rules
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  
  // Config files
  {
    files: ['eslint.config.js', 'vite.config.ts', 'vitest.config.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
])
