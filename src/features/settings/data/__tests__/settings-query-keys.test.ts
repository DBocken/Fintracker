/**
 * Query-Keys der Einstellungs-Slice (WP 6.5b, Kochrezept Schritt 4).
 *
 * Die Keys sind aus `EnhancedSettings.tsx`/`CategoryManager.tsx` übernommen und
 * müssen BYTE-IDENTISCH bleiben: Andere Flächen invalidieren dieselben Listen
 * (`['transactions']` nach der Sammel-Neukategorisierung, `['merchant-rules']`
 * und `['budget-overview']` nach dem Löschen einer Kategorie). Ein
 * umbenannter Key bricht nichts sichtbar — die Fläche zeigt danach nur still
 * veraltete Zahlen. Deshalb ein Test auf die Literale selbst.
 */
import { describe, it, expect } from 'vitest';
import { SETTINGS_QUERY_KEYS } from '../settings-query-keys';

describe('SETTINGS_QUERY_KEYS', () => {
  it('sollte die Bestands-Keys unverändert lassen', () => {
    expect(SETTINGS_QUERY_KEYS.userSettings).toEqual(['userSettings']);
    expect(SETTINGS_QUERY_KEYS.hierarchicalCategories).toEqual(['hierarchicalCategories']);
    expect(SETTINGS_QUERY_KEYS.categorySuggestion).toEqual(['category-suggestion']);
  });

  it('sollte die Keys unverändert lassen, die nach einer Änderung mitziehen', () => {
    expect(SETTINGS_QUERY_KEYS.transactions).toEqual(['transactions']);
    expect(SETTINGS_QUERY_KEYS.budgetOverview).toEqual(['budget-overview']);
    expect(SETTINGS_QUERY_KEYS.merchantRules).toEqual(['merchant-rules']);
  });
});
