import { deleteLocalCategory, getLocalCategories } from './local-settings-service';
import { getBudgets, replaceBudgets } from './budget-service';
import { getMerchantRules, deleteMerchantRule } from './merchant-rules-service';

export interface CategoryDeletionResult {
  /** IDs der gelöschten Kategorien (Kategorie + direkte Kinder). */
  deletedCategoryIds: string[];
  /** Budgets, deren Hauptkategorie gelöscht wurde (mit entfernt). */
  deletedBudgets: number;
  /** Budgets, aus denen gelöschte Unterkategorien entfernt wurden. */
  prunedBudgets: number;
  /** Händlerregeln, die auf gelöschte Kategorien zeigten (mit entfernt). */
  deletedRules: number;
}

/**
 * Löscht eine Kategorie inkl. direkter Kinder UND bereinigt referenzierende
 * Daten: Budgets mit gelöschter Hauptkategorie werden entfernt, gelöschte
 * Unterkategorien aus `subcategory_ids` gestrichen, Händlerregeln auf
 * Geist-Kategorien gelöscht. Vorher blieben Zombie-Budgets zurück, deren
 * Unterkategorie-Ausgaben still aus der Summe fielen, und Regeln mappten
 * weiter auf nicht existierende Kategorien (Audit F-CAT-DELETE).
 *
 * Transaktionen behalten ihre (nun verwaiste) category_id bewusst: Analysen
 * fallen deterministisch auf „Unkategorisiert" zurück (getestete Robustheit),
 * und ein Massen-Update wäre im Ein-Blob-Store unverhältnismäßig teuer.
 */
export async function deleteCategory(id: string): Promise<CategoryDeletionResult> {
  // Gelöschte IDs VOR dem Löschen bestimmen (Kategorie + direkte Kinder —
  // gleiche Semantik wie deleteLocalCategory).
  const categories = await getLocalCategories();
  const deletedIds = new Set(
    categories.filter((c) => c.id === id || c.parent_id === id).map((c) => c.id),
  );
  deletedIds.add(id);

  await deleteLocalCategory(id);

  // Budgets bereinigen.
  const budgets = await getBudgets();
  let deletedBudgets = 0;
  let prunedBudgets = 0;
  const keptBudgets = budgets
    .filter((b) => {
      if (deletedIds.has(b.category_id)) {
        deletedBudgets += 1;
        return false;
      }
      return true;
    })
    .map((b) => {
      if (!b.subcategory_ids?.length) return b;
      const pruned = b.subcategory_ids.filter((sid) => !deletedIds.has(sid));
      if (pruned.length === b.subcategory_ids.length) return b;
      prunedBudgets += 1;
      // Leere Auswahl = „alle Unterkategorien zählen" (Formular-Semantik).
      return { ...b, subcategory_ids: pruned.length ? pruned : undefined };
    });
  if (deletedBudgets > 0 || prunedBudgets > 0) {
    await replaceBudgets(keptBudgets);
  }

  // Händlerregeln bereinigen (einzeln löschen, damit das Audit-Log greift).
  const rules = await getMerchantRules();
  let deletedRules = 0;
  for (const rule of rules) {
    if (deletedIds.has(rule.category_id)) {
      await deleteMerchantRule(rule.id);
      deletedRules += 1;
    }
  }

  return {
    deletedCategoryIds: Array.from(deletedIds),
    deletedBudgets,
    prunedBudgets,
    deletedRules,
  };
}
