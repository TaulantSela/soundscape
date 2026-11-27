// Port of the ESLint 8 apps/desktop/.eslintrc.cjs, which cascaded onto the root config and then
// re-applied eslint:recommended (so base rules like no-undef also cover its TypeScript).
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import rootConfig from '../../eslint.config.mjs';

export default defineConfig([
  rootConfig,
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2021, sourceType: 'module', globals: globals.node },
    rules: { 'no-console': 'off' }
  }
]);
