import path from 'node:path';
import { fileURLToPath } from 'node:url';
import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-tests/**',
      'coverage/**',
      'artifacts/**',
      '.vscode-test/**',
      'node_modules/**',
      '*.config.cjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    ...tseslint.configs.disableTypeChecked,
    files: ['**/*.{js,mjs,cjs}'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: [
          './tsconfig.core.json',
          './tsconfig.extension.json',
          './tsconfig.webview.json',
          './tsconfig.tests.json',
        ],
        tsconfigRootDir: rootDirectory,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      complexity: ['error', 10],
      'max-depth': ['error', 4],
      'max-lines': ['error', { max: 320, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 65, skipBlankLines: true, skipComments: true },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-duplicate-imports': 'error',
    },
  },
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'vscode',
                'react',
                'react-dom',
                'node:*',
                '../extension/**',
                '../../extension/**',
                '../webview/**',
                '../../webview/**',
              ],
              message: 'Core 必须保持与运行环境无关。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/webview/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'vscode',
                'node:*',
                '../../extension/**',
                '../../../extension/**',
              ],
              message: 'Webview 代码不得依赖扩展宿主或 Node API。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/extension/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.mocha } },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 850, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 120, skipBlankLines: true, skipComments: true },
      ],
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['build/**/*.mjs', 'scripts/**/*.mjs', '*.config.mjs', '.vscode-test.mjs'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-console': 'off',
      'max-lines': ['error', { max: 600, skipBlankLines: true, skipComments: true }],
    },
  },
);
