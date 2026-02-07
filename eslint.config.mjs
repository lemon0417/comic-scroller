import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier';

const reactRecommended = react.configs.flat.recommended || {};
const reactJsxRuntime = react.configs.flat['jsx-runtime'] || {};
const importRecommended = importPlugin.configs?.recommended || {};
const jsxA11yRecommended = jsxA11y.configs?.recommended || {};

export default [
  {
    ignores: [
      '**/node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'dist/**',
      'scripts/**',
      'server.js',
      '**/*.test.*',
      '**/__mocks__/**',
    ],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: 'readonly',
        ga: 'readonly',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
      '@typescript-eslint': tsPlugin,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        alias: {
          map: [
            ['@styles', './src/styles'],
            ['@assets', './src/assets'],
            ['@imgs', './src/assets/imgs'],
            ['@ui', './src/ui'],
            ['@components', './src/ui/components'],
            ['@containers', './src/ui/containers'],
            ['@domain', './src/domain'],
            ['@epics', './src/epics'],
            ['@infra', './src/infra'],
            ['@utils', './src/utils'],
            ['@background', './src/background'],
          ],
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.css'],
        },
      },
    },
    rules: {
      ...reactRecommended.rules,
      ...reactJsxRuntime.rules,
      ...importRecommended.rules,
      ...jsxA11yRecommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'prefer-arrow-callback': 'off',
      'arrow-body-style': 'off',
      'no-useless-escape': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'react/prefer-stateless-function': 'off',
      'react/sort-comp': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/anchor-is-valid': 'off',
      'import/no-unresolved': 'off',
    },
  },
  {
    files: ['**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  prettier,
];
