/** @type {import('eslint').FlatConfig[]} */
module.exports = {
  root: true,
  extends: [
    'next',
    'next/core-web-vitals',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:jest/recommended'
  ],
  plugins: ['@typescript-eslint', 'react', 'jest'],
  env: {
    browser: true,
    node: true,
    jest: true
  },
  ignores: [
    'node_modules/',
    'build/',
    '.next/',
    'public/',
    'coverage/'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-empty': 'warn',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-undef': 'off',
    'jest/no-standalone-expect': 'off',
    'jest/no-export': 'off'
  },
};
