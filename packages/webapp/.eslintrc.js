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

// The only modules allowed to touch Web Storage; their keys live in constant.ts.
const STORAGE_MODULES = [
  'src/main/shared/services/storage/**',
  'src/main/shared/services/llmKeyStorage.ts',
  'src/main/features/spec-driven/storage.ts',
]
const STORAGE_MESSAGE =
  'Use a module in shared/services/storage/ (or llmKeyStorage.ts, features/spec-driven/storage.ts) instead of Web Storage directly.'
// Catches window.localStorage, casts, aliases (`w.sessionStorage`), document.defaultView and destructuring.
const STORAGE_PROPERTY = '/^(localStorage|sessionStorage)$/'
const STORAGE_SYNTAX = [
  `MemberExpression[property.name=${STORAGE_PROPERTY}]`,
  `MemberExpression[computed=true][property.value=${STORAGE_PROPERTY}]`,
  `ObjectPattern > Property[key.name=${STORAGE_PROPERTY}]`,
].map((selector) => ({ selector, message: STORAGE_MESSAGE }))
const STORAGE_GLOBALS = ['localStorage', 'sessionStorage'].map((name) => ({ name, message: STORAGE_MESSAGE }))

const GLOBAL_OBJECT = '/^(window|globalThis|self)$/'
const HTTP_MESSAGE = 'Call the backend through a module in shared/api/, not fetch/XMLHttpRequest/sendBeacon directly.'
const HTTP_SYNTAX = [
  "CallExpression[callee.name='fetch']",
  `CallExpression[callee.object.name=${GLOBAL_OBJECT}][callee.property.name='fetch']`,
  "CallExpression[callee.property.name='sendBeacon']",
  "NewExpression[callee.name='XMLHttpRequest']",
  `NewExpression[callee.object.name=${GLOBAL_OBJECT}][callee.property.name='XMLHttpRequest']`,
  // fetch taken as a value, to be called under another name: `const f = fetch`, `f = window.fetch`,
  // `const { fetch } = window`, `fetch.call(...)`.
  ":matches(VariableDeclarator > .init, AssignmentExpression > .right)[name='fetch']",
  `:matches(VariableDeclarator > .init, AssignmentExpression > .right)[object.name=${GLOBAL_OBJECT}][property.name='fetch']`,
  `VariableDeclarator[init.name=${GLOBAL_OBJECT}] > ObjectPattern > Property[key.name='fetch']`,
  "MemberExpression[object.name='fetch']",
].map((selector) => ({ selector, message: HTTP_MESSAGE }))

const SECRET_SYNTAX = [
  // Any spelling inside the attribute: type="password", type={'password'}, type={show ? 'text' : 'password'}.
  "JSXAttribute[name.name='type'][value.value='password']",
  "JSXAttribute[name.name='type'] Literal[value='password']",
  "JSXAttribute[name.name='type'] TemplateElement[value.raw='password']",
].map((selector) => ({
  selector,
  message: 'Use SecretInput from @/components/ui/secret-input: a controlled password input copies its value into the DOM.',
}))

const REPORT_ERROR_MESSAGE = 'Report a failure with reportError() from shared/services/errors/reportError.'
const REPORT_ERROR_GLOBAL = { name: 'reportError', message: `Import it: ${REPORT_ERROR_MESSAGE}` }
const ALERT_MESSAGE = 'Use globalAlert() from shared/services/confirm/globalConfirm instead of alert().'
const ERROR_SYNTAX = [
  { selector: "CallExpression[callee.object.name='toast'][callee.property.name='error']", message: REPORT_ERROR_MESSAGE },
  { selector: "CallExpression[callee.object.name='toast'][callee.property.value='error']", message: REPORT_ERROR_MESSAGE },
  // `toast(m, { type: 'error' })`, and `toast.update(id, { type: 'error' })` (use reportError's `updateToast`).
  {
    selector: "CallExpression[callee.name='toast'] > ObjectExpression > Property[key.name='type'][value.value='error']",
    message: REPORT_ERROR_MESSAGE,
  },
  {
    selector:
      "CallExpression[callee.object.name='toast'][callee.property.name='update'] > ObjectExpression > Property[key.name='type'][value.value='error']",
    message: REPORT_ERROR_MESSAGE,
  },
  // A renamed import (`import { toast as t }`) would slip past the selectors above.
  { selector: "ImportSpecifier[imported.name='toast'][local.name!='toast']", message: 'Import toast under its own name.' },
  { selector: `CallExpression[callee.object.name=${GLOBAL_OBJECT}][callee.property.name='reportError']`, message: REPORT_ERROR_MESSAGE },
  { selector: "CallExpression[callee.name='alert']", message: ALERT_MESSAGE },
  { selector: `CallExpression[callee.object.name=${GLOBAL_OBJECT}][callee.property.name='alert']`, message: ALERT_MESSAGE },
]
const TESTS = ['**/__tests__/**', '**/*.test.{ts,tsx}', 'src/test/**']

// Every backend call is a function in shared/api; tests may still stub the client.
const API_CLIENT_IMPORT = {
  regex: '(^|/)api-client$',
  importNames: ['apiClient'],
  message: 'Call the backend through a function in shared/api/, not apiClient directly.',
}

// A later block replaces the rule's whole list, so non-test files get API_CLIENT_IMPORT back.
const featureBoundary = (feature) => {
  const files = [`src/main/features/${feature}/**/*.{ts,tsx}`]
  const patterns = [
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
  ]
  return [
    { files, rules: { 'no-restricted-imports': ['error', { patterns }] } },
    { files, ignores: TESTS, rules: { 'no-restricted-imports': ['error', { patterns: [...patterns, API_CLIENT_IMPORT] }] } },
  ]
}

const SHARED_BOUNDARY = {
  regex: `(${PARENT_DIRS}|${MAIN_ALIAS}/)(app|features)(/|$)`,
  message: 'shared/ must not depend on app/ or features/.',
}

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
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: TESTS,
    rules: { 'no-restricted-imports': ['error', { patterns: [API_CLIENT_IMPORT] }] },
  },
  ...features.flatMap(featureBoundary),
  // no-restricted-globals: Web Storage only through the storage modules; and the global
  // window.reportError is not ours, so a missing import must not compile silently.
  // A later block replaces the rule's whole list, so the storage modules get the reportError ban back.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: TESTS,
    rules: { 'no-restricted-globals': ['error', ...STORAGE_GLOBALS, REPORT_ERROR_GLOBAL] },
  },
  {
    files: STORAGE_MODULES,
    ignores: TESTS,
    rules: { 'no-restricted-globals': ['error', REPORT_ERROR_GLOBAL] },
  },
  // no-restricted-syntax: HTTP only through shared/api (`typeof fetch` checks stay allowed);
  // error toasts only through reportError; no alert(); no Web Storage property access.
  // A later block replaces the rule's whole list, so each exempt folder gets the other lists back.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: TESTS,
    rules: { 'no-restricted-syntax': ['error', ...HTTP_SYNTAX, ...ERROR_SYNTAX, ...STORAGE_SYNTAX, ...SECRET_SYNTAX] },
  },
  {
    files: ['src/main/shared/api/**/*.{ts,tsx}'],
    ignores: TESTS,
    rules: { 'no-restricted-syntax': ['error', ...ERROR_SYNTAX, ...STORAGE_SYNTAX, ...SECRET_SYNTAX] },
  },
  {
    files: ['src/main/shared/services/errors/**/*.{ts,tsx}'],
    ignores: TESTS,
    rules: { 'no-restricted-syntax': ['error', ...HTTP_SYNTAX, ...STORAGE_SYNTAX, ...SECRET_SYNTAX] },
  },
  {
    files: STORAGE_MODULES,
    ignores: TESTS,
    rules: { 'no-restricted-syntax': ['error', ...HTTP_SYNTAX, ...ERROR_SYNTAX, ...SECRET_SYNTAX] },
  },
  {
    files: ['src/main/shared/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [SHARED_BOUNDARY] }] },
  },
  {
    files: ['src/main/shared/**/*.{ts,tsx}'],
    ignores: [...TESTS, 'src/main/shared/api/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [SHARED_BOUNDARY, API_CLIENT_IMPORT] }] },
  },
]
