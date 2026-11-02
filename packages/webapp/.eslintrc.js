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
