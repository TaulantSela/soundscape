// Port of the ESLint 8 apps/mobile/.eslintrc.cjs, which cascaded onto the root config and added
// universe/native (Expo's style: Prettier, import order, React Native); eslint-config-universe 16
// ships the same preset as a flat config.
import { defineConfig, globalIgnores } from 'eslint/config';
import universeNative from 'eslint-config-universe/flat/native.js';
import rootConfig from '../../eslint.config.mjs';

export default defineConfig([
  rootConfig,
  universeNative,
  globalIgnores(['dist', 'build']),
  {
    // eslint-plugin-react's React-version detection calls context.getFilename, which ESLint 10
    // removed; naming the version skips it (eslint-config-next does the same for apps/web).
    settings: { react: { version: '19.3' } },
    rules: {
      // universe 16 turns its Prettier check off; universe 13 had it on, so keep the formatting check
      'prettier/prettier': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^ignored' }]
    }
  }
]);
