import globals from 'globals';
import tseslint from 'typescript-eslint';
import base from './base.js';

/** NestJS: decorators need runtime class imports, so type-only import enforcement is relaxed. */
export default tseslint.config(...base, {
  languageOptions: {
    globals: { ...globals.node },
  },
  rules: {
    // Nest DI reads constructor param types at runtime (emitDecoratorMetadata);
    // `import type` would erase them and break injection.
    '@typescript-eslint/consistent-type-imports': 'off',
    '@typescript-eslint/no-extraneous-class': 'off',
  },
});
