// Ignore build and config output for ESLint v9+ flat config
/** @type {import('eslint').FlatConfig[]} */
const ignores = [
  {
    ignores: [
      '**/.next/**',
      '**/build/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/tailwind.config.js',
      '**/postcss.config.js',
      '**/*.config.js',
      '!eslint.config.js',
    ],
  },
];

// ESLint v9+ flat config for Next.js + TypeScript + React
const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');


/** @type {import('eslint').FlatConfig[]} */
module.exports = [
  ...ignores,
  {
    ...js.configs.recommended,
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: {
        ...js.configs.recommended.languageOptions?.globals,
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        process: 'readonly',
        prompt: 'readonly',
        FormData: 'readonly',
        Response: 'readonly',
        setTimeout: 'readonly',
        WebAssembly: 'readonly',
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json'],
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Stricter rules enabled for higher code quality
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
    },
  },
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // Not needed for React 17+
    },
  },
];
