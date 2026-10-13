import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'tests/**',
    'src/booking/**',
    'src/modules/**',
    'src/queue/**',
    'src/gateway/**',
    'src/services/**',
    'routes/**',
    'controllers/**',
    'models/**',
    'middleware/**',
    'realtime/**',
    'config/**',
    'ai/**',
    'server.js',
    'app.js',
    'migrate_roles.js',
    'promote_admin.js',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]|motion', argsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': 'warn',
    },
  },
])
