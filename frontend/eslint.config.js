// Minimal ESLint Flat Config for Next.js, TypeScript, React, and Jest
// ...existing code...

/** @type {import('eslint').FlatConfig[]} */
module.exports = [
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: require('@typescript-eslint/parser'),
      globals: {
        window: true,
        document: true,
        browser: true,
        node: true,
        jest: true,
      },
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      react: require('eslint-plugin-react'),
      'react-hooks': require('eslint-plugin-react-hooks'),
      jest: require('eslint-plugin-jest'),
    },
    rules: {
      'no-empty': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-undef': 'off',
      'jest/no-standalone-expect': 'off',
      'jest/no-export': 'off',
    },
  },
  {
    ignores: [
      'node_modules/',
      'build/',
      '.next/',
      'public/',
      'coverage/'
    ],
  },
];
