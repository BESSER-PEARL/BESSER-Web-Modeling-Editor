const typescriptEslintPlugin = require('@typescript-eslint/eslint-plugin')
const typescriptParser = require('@typescript-eslint/parser')
const reactHooksPlugin = require('eslint-plugin-react-hooks')
const fs = require('fs')
const path = require('path')

// Import boundaries. A feature is used by other features only through its
// index.ts; shared/ depends on neither app/ nor features/.
const features = fs
  .readdirSync(path.join(__dirname, 'src/main/features'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
const MAIN_ALIAS = '^(@/main|webapp/src/main)'
const PARENT_DIRS = '^(\\.\\./)+'

const STORAGE_MESSAGE =
  'Use a module in shared/services/storage/ (or llmKeyStorage) instead of Web Storage directly.'

const HTTP_MESSAGE = 'Call the backend through a module in shared/api/, not fetch/XMLHttpRequest/sendBeacon directly.'
const HTTP_SYNTAX = [
  "CallExpression[callee.name='fetch']",
  "CallExpression[callee.object.name=/^(window|globalThis|self)$/][callee.property.name='fetch']",
  "CallExpression[callee.property.name='sendBeacon']",
  "NewExpression[callee.name='XMLHttpRequest']",
].map((selector) => ({ selector, message: HTTP_MESSAGE }))

const REPORT_ERROR_MESSAGE = 'Report a failure with reportError() from shared/services/errors/reportError.'
const ALERT_MESSAGE = 'Use globalAlert() from shared/services/confirm/globalConfirm instead of alert().'
const ERROR_SYNTAX = [
  { selector: "CallExpression[callee.object.name='toast'][callee.property.name='error']", message: REPORT_ERROR_MESSAGE },
  { selector: "CallExpression[callee.name='alert']", message: ALERT_MESSAGE },
  { selector: "CallExpression[callee.object.name=/^(window|globalThis|self)$/][callee.property.name='alert']", message: ALERT_MESSAGE },
]
const TESTS = ['**/__tests__/**', '**/*.test.{ts,tsx}']

const featureBoundary = (feature) => ({
  files: [`src/main/features/${feature}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            regex: `${PARENT_DIRS}(features/)?(?!${feature}/)(${features.join('|')})/`,
            message: 'Import another feature through its index.ts, not its internals.',
          },
          {
            regex: `${MAIN_ALIAS}/features/(?!${feature}/)[^/]+/`,
            message: 'Import another feature through its index.ts, not its internals.',
          },
          {
            regex: `(${PARENT_DIRS}(features/)?|${MAIN_ALIAS}/features/)${feature}$`,
            message: "Import the file directly: going through the feature's own index.ts creates a cycle.",
          },
        ],
      },
    ],
  },
})

module.exports = [
  {
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslintPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      'no-constant-condition': 'warn', 
      'no-empty': 'warn', 
      'prefer-const': 'warn',

      '@typescript-eslint/no-explicit-any': 'warn', 
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/ban-ts-comment': [
        'warn',
        { 'ts-ignore': 'allow-with-description' } 
      ],

      '@typescript-eslint/ban-types': 'off', 
      '@typescript-eslint/no-namespace': 'off', 

      // The codebase carries `eslint-disable` comments for exhaustive-deps,
      // which fail as "rule not found" unless the plugin is registered.
      // rules-of-hooks is an error because a violation is a real bug.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    files: ['**/*.ts', '**/*.tsx'],
  },
  ...features.map(featureBoundary),
  // Web Storage only through the typed storage modules; their keys live in constant.ts.
  // Also: the global window.reportError is not ours, so a missing import must not compile silently.
  {
    files: ['src/main/**/*.{ts,tsx}'],
    ignores: [
      'src/main/shared/services/storage/**',
      'src/main/shared/services/llmKeyStorage.ts',
      'src/main/features/spec-driven/storage.ts',
      '**/__tests__/**',
      '**/*.test.{ts,tsx}',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['localStorage', 'sessionStorage'].map((name) => ({ name, message: STORAGE_MESSAGE })),
        { name: 'reportError', message: `Import it: ${REPORT_ERROR_MESSAGE}` },
      ],
      'no-restricted-properties': [
        'error',
        ...['window', 'globalThis', 'self'].flatMap((object) =>
          ['localStorage', 'sessionStorage'].map((property) => ({ object, property, message: STORAGE_MESSAGE })),
        ),
      ],
    },
  },
  // no-restricted-syntax: HTTP only through shared/api (`typeof fetch` checks stay allowed);
  // error toasts only through reportError; no alert(). A later block replaces the
  // rule's whole list, so the two exempt folders get the other list back.
  {
    files: ['src/main/**/*.{ts,tsx}'],
    ignores: TESTS,
    rules: { 'no-restricted-syntax': ['error', ...HTTP_SYNTAX, ...ERROR_SYNTAX] },
  },
  {
    files: ['src/main/shared/api/**/*.{ts,tsx}'],
    ignores: TESTS,
    rules: { 'no-restricted-syntax': ['error', ...ERROR_SYNTAX] },
  },
  {
    files: ['src/main/shared/services/errors/**/*.{ts,tsx}'],
    ignores: TESTS,
    rules: { 'no-restricted-syntax': ['error', ...HTTP_SYNTAX] },
  },
  {
    files: ['src/main/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: `(${PARENT_DIRS}|${MAIN_ALIAS}/)(app|features)(/|$)`,
              message: 'shared/ must not depend on app/ or features/.',
            },
          ],
        },
      ],
    },
  },
]
