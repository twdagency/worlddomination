import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/node_modules/**', '**/.expo/**', '**/dist/**'],
  },
  {
    plugins: { 'unused-imports': unusedImports },
    rules: {
      // Unused imports are auto-fixable and always safe to strip; unused
      // variables are not, so they stay a hand-fixed error.
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      // `_`-prefixed identifiers are intentional discards (unused args, throwaway
      // destructuring targets such as `const { x: _removed, ...rest } = obj`).
      'unused-imports/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
);
