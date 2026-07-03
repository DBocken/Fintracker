import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'android/**', 'supabase/**', 'mcp-poc/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        console: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        confirm: 'readonly',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: {
      'react/no-danger': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-proptypes': 'warn',
      'jsx-a11y/aria-unsupported-elements': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      'jsx-a11y/role-supports-aria-props': 'warn',
    },
  },

  // Leitplanke 1: UI (Komponenten/Pages) darf Services nicht mehr direkt
  // importieren. Datenzugriff läuft über einen Hook in `@/hooks/data/*`, damit
  // die Präsentationsschicht von der Datenschicht entkoppelt bleibt und in
  // mehreren Darstellungsmodi wiederverwendbar ist. Start als `warn`, damit die
  // bestehenden ~53 Altimporte den Build nicht brechen; wird nach der Migration
  // je Feature auf `error` gehoben.
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/pages/**/*.{ts,tsx}'],
    ignores: ['src/components/providers/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['warn', {
        patterns: [
          {
            group: ['@/services/*', '**/services/*'],
            message:
              'Kein direkter Service-Import in der UI. Kapsle den Datenzugriff in einem Hook unter @/hooks/data/*.',
          },
        ],
      }],
    },
  },

  // Leitplanke 2: Services bleiben IO-frei von react-query. Query-Hooks und
  // Cache-Invalidierung gehören in die Hook-Schicht. Aktuell noch `warn`, weil
  // zwei Altlasten (bank-connection-service exportiert Hooks, gocardless-sync-
  // service hält einen globalen queryClient) das noch verletzen — sobald diese
  // beiden als eigener Vertikalschnitt bereinigt sind, wird die Regel `error`.
  {
    files: ['src/services/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['warn', {
        paths: [
          {
            name: '@tanstack/react-query',
            message:
              'Services sind IO-frei von react-query. Hooks/Invalidierung gehören nach @/hooks/data/*.',
          },
        ],
      }],
    },
  },
];
