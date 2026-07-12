// Query-Keys byte-identisch zu den bisher inline verstreuten Literalen halten —
// jede Abweichung würde bestehende Caches und Invalidierungen stillschweigend trennen.
export const financeKeys = {
  transactionsRoot: ['transactions'] as const,
  transactions: (limit: number) => ['transactions', limit] as const,
  categories: ['categories'] as const,
  accounts: ['accounts'] as const,
  contractDecisions: ['contract-decisions'] as const,
} as const;

// Dashboard lädt bewusst 5000 Buchungen (F-PERF-3): Limit im Key verhindert
// Cache-Kollision mit dem 1000er-Load von useAutomationSuggestions.
export const FINANCE_TRANSACTION_LIMIT = 5000;
