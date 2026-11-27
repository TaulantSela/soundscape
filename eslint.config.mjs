// Flat-config port of the ESLint 8 .eslintrc.cjs (ESLint 10 dropped eslintrc): the same presets,
// settings and rules. It lints packages/* and apps/api; apps/desktop and apps/mobile extend it,
// and apps/web has its own Next.js config.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/node_modules/', '**/dist/', '**/build/', '**/.next/', '**/web-build/', '**/out/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
      parserOptions: { project: './tsconfig.json' }
    },
    settings: {
      'import/resolver': { typescript: true, node: true }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off'
    }
  },
  prettier
]);
