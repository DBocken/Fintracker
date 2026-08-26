/**
 * Vorschau der Auto-Kategorisierung für die CSV-Review-Tabelle.
 *
 * WICHTIG: nutzt exakt dieselbe Engine wie die tatsächliche Zuweisung
 * (createCategorizer inkl. gelernter Regeln, Payee-Normalisierung,
 * Spezifität, Richtungs-Guard) UND denselben Konfidenz-Floor — die angezeigte
 * „Auto-Kategorie" kann damit nie von der später geschriebenen abweichen.
 * (Die frühere Zweit-Implementierung in ReviewTable matchte substring/first-
 * match ohne Regeln und konnte der echten Zuweisung widersprechen.)
 */
import type { Category, Transaction } from '@/types';
import type { MerchantRule } from '@/lib/categorization';
import { createCategorizer, MIN_SILENT_ASSIGN_CONFIDENCE } from '@/lib/categorization';
import { suggestionConfidenceLevel, type SuggestionConfidenceLevel } from '@/lib/automation-suggestions';

export interface AutoCategoryPreview {
  category: Category;
  level: SuggestionConfidenceLevel;
}

export function buildAutoCategoryPreview(
  rows: Transaction[],
  categories: Category[],
  learnedRules: MerchantRule[],
): Map<string, AutoCategoryPreview> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const categorizer = createCategorizer(categories, learnedRules);
  const preview = new Map<string, AutoCategoryPreview>();

  for (const row of rows) {
    if (!row.id) continue;
    const result = categorizer.explain(row);
    if (!result.categoryId || result.confidence < MIN_SILENT_ASSIGN_CONFIDENCE) continue;
    const category = byId.get(result.categoryId);
    if (!category) continue;
    preview.set(row.id, { category, level: suggestionConfidenceLevel(result.confidence) });
  }

  return preview;
}
