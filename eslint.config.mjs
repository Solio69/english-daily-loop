import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist/**', 'dist-telegram/**', 'coverage/**', 'node_modules/**'],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs}'],
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off',
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.flat.recommended.rules,
  },
)
