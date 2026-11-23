import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import base from './base.js';

/** Next.js App Router config. */
export default tseslint.config(...base, {
  plugins: {
    '@next/next': nextPlugin,
    'react-hooks': reactHooks,
  },
  languageOptions: {
    globals: { ...globals.browser, ...globals.node },
  },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs['core-web-vitals'].rules,
    ...reactHooks.configs.recommended.rules,
  },
});
