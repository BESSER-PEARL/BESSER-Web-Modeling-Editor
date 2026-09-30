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

      // The codebase carries `eslint-disable` comments for exhaustive-deps,
      // which fail as "rule not found" unless the plugin is registered.
      // rules-of-hooks is an error because a violation is a real bug.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    files: ['**/*.ts', '**/*.tsx'],
  },
]
