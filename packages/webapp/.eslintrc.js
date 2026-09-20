const typescriptEslintPlugin = require('@typescript-eslint/eslint-plugin')
const typescriptParser = require('@typescript-eslint/parser')
const reactHooksPlugin = require('eslint-plugin-react-hooks')

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

      // The codebase already carries `eslint-disable` comments for
      // exhaustive-deps; without the plugin registered those comments were
      // themselves 11 lint ERRORS ("rule not found"), so the gate was red at
      // every commit. rules-of-hooks is at 'error' because it is clean today
      // and a violation is a real bug, not a style opinion.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    files: ['**/*.ts', '**/*.tsx'],
  },
]
