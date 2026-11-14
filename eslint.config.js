import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'examples/*/dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Keep state, timing and markup helpers free of React so they stay
    // simple to test and reason about. React lives in the view files only.
    files: ['src/**/*.ts'],
    ignores: ['src/useToasts.ts', 'src/index.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'Only view files (*.tsx, useToasts.ts) may import React.',
              allowTypeImports: true,
            },
            {
              name: 'react-dom',
              message: 'Only view files (*.tsx) may import react-dom.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
);
