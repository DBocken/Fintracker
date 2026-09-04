/**
 * Query-Keys der Einstellungs-Slice (WP 6.5b, Kochrezept Schritt 4).
 *
 * BYTE-IDENTISCH zu den Literalen, die bis WP 6.5b in `EnhancedSettings.tsx`
 * und `CategoryManager.tsx` standen. Die letzten drei gehören anderen Flächen
 * und werden hier nur invalidiert — eine Sammel-Neukategorisierung ändert
 * Buchungen, ein gelöschte Kategorie räumt Budgets und Händlerregeln mit.
 * Ein umbenannter Key bricht davon nichts sichtbar; die andere Fläche zeigt
 * danach nur still veraltete Zahlen.
 */
import { financeKeys } from '@/features/shared/data/finance-query-keys';

export const SETTINGS_QUERY_KEYS = {
  userSettings: ['userSettings'] as const,
  hierarchicalCategories: ['hierarchicalCategories'] as const,
  categorySuggestion: ['category-suggestion'] as const,
  transactions: ['transactions'] as const,
  /** Geteilt — die Definition liegt in `features/shared/data`. */
  budgetOverview: financeKeys.budgetOverview,
  merchantRules: ['merchant-rules'] as const,
} as const;
