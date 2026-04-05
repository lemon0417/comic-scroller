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
const tsRecommended = tsPlugin.configs?.recommended || {};

export default [
  {
    ignores: [
      '**/node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'scripts/**',
      'server.js',
    ],
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
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
            ['@sites', './src/sites'],
            ['@infra', './src/infra'],
            ['@utils', './src/utils'],
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
      ...tsRecommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          minimumDescriptionLength: 8,
          'ts-check': false,
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
        },
      ],
      '@typescript-eslint/no-explicit-any': [
        'error',
        {
          ignoreRestArgs: true,
        },
      ],
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
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-undef': 'off',
    },
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    ignores: [
      'src/infra/services/library/**/*',
      '**/*.test.{js,jsx,ts,tsx}',
      '**/__tests__/**/*.{js,jsx,ts,tsx}',
      '**/__mocks__/**/*.{js,jsx,ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@infra/services/library',
              message:
                'Use a scene-specific facade (`@infra/services/library/reader`, `/popup`, `/background`) instead of the root barrel.',
            },
            {
              name: '@infra/services/library/shared',
              message:
                'Do not import repository internals from app code. Use a facade or the public schema/models modules instead.',
            },
            {
              name: '@infra/services/library/queries',
              message:
                'Do not import repository internals from app code. Use a facade or the public schema/models modules instead.',
            },
            {
              name: '@infra/services/library/mutations',
              message:
                'Do not import repository internals from app code. Use a facade or the public schema/models modules instead.',
            },
            {
              name: '@infra/services/library/compat',
              message:
                'Do not import repository internals from app code. Use a facade or the public schema/models modules instead.',
            },
            {
              name: '@infra/services/library/signal',
              message:
                'Do not import repository internals from app code. Use a facade or the public schema/models modules instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/epics/popup/**/*.{js,jsx,ts,tsx}',
      'src/ui/containers/PopupApp/**/*.{js,jsx,ts,tsx}',
      'src/ui/containers/ManageApp/**/*.{js,jsx,ts,tsx}',
    ],
    ignores: [
      '**/*.test.{js,jsx,ts,tsx}',
      '**/__tests__/**/*.{js,jsx,ts,tsx}',
      '**/__mocks__/**/*.{js,jsx,ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@infra/services/library/reader',
              message:
                'Popup and manage code must use `@infra/services/library/popup` instead of the reader facade.',
            },
            {
              name: '@infra/services/library/background',
              message:
                'Popup and manage code must use `@infra/services/library/popup` instead of the background facade.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/ui/containers/App/**/*.{js,jsx,ts,tsx}',
      'src/ui/containers/ChapterList/**/*.{js,jsx,ts,tsx}',
      'src/ui/containers/ImageContainer/**/*.{js,jsx,ts,tsx}',
      'src/ui/components/ComicImage/**/*.{js,jsx,ts,tsx}',
      'src/epics/sites/**/*.{js,jsx,ts,tsx}',
      'src/epics/subscribeEpic.ts',
      'src/epics/scrollEpic.ts',
    ],
    ignores: [
      '**/*.test.{js,jsx,ts,tsx}',
      '**/__tests__/**/*.{js,jsx,ts,tsx}',
      '**/__mocks__/**/*.{js,jsx,ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@infra/services/library/popup',
              message:
                'Reader code must use `@infra/services/library/reader` instead of the popup facade.',
            },
            {
              name: '@infra/services/library/background',
              message:
                'Reader code must use `@infra/services/library/reader` instead of the background facade.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/background.ts', 'src/infra/services/background.ts'],
    ignores: [
      '**/*.test.{js,jsx,ts,tsx}',
      '**/__tests__/**/*.{js,jsx,ts,tsx}',
      '**/__mocks__/**/*.{js,jsx,ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@infra/services/library/reader',
              message:
                'Background code must use `@infra/services/library/background` instead of the reader facade.',
            },
            {
              name: '@infra/services/library/popup',
              message:
                'Background code must use `@infra/services/library/background` instead of the popup facade.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.test.{js,jsx,ts,tsx}',
      '**/__tests__/**/*.{js,jsx,ts,tsx}',
      '**/__mocks__/**/*.{js,jsx,ts,tsx}',
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
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
