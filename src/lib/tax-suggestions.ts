// Reiner Produzent für Steuer-Rubrik-Vorschläge („Automatisch, aber nie
// bevormundend"): schlägt für unmarkierte Ausgaben eine Steuer-Rubrik vor —
// niemals automatisch markiert. Die Entscheidung des Nutzers wird persistiert,
// damit ein abgelehnter Vorschlag nicht wiederkehrt.
//
// On-demand & rein: berechnet aus vorhandenen Daten ohne Import-Pipeline.

import { buildTaxSuggestion } from '@/services/automation-suggestion-service';
import type { AutomationSuggestion } from '@/services/automation-suggestion-service';
import { TAX_CATEGORIES, taxCategoryById, getRubricForCategory } from '@/data/tax-catalog';
import type { Category, Transaction } from '@/types';
import { t } from '@/i18n/serviceT';

/** Confidence-Stufen je Match-Quelle. */
export const TAX_CONFIDENCE = {
  categoryDefault: 0.9,
  keyword: 0.7,
  flagged: 0.55,
} as const;

function rubricName(taxCategoryId: string): string {
  const rubric = getRubricForCategory(taxCategoryId);
  return rubric ? t(rubric.nameKey as never, rubric.id) : taxCategoryId;
}

/** Erstes Keyword einer Steuer-Kategorie, das im Text vorkommt. */
function keywordMatch(haystack: string): { taxCategoryId: string; keyword: string } | null {
  for (const cat of TAX_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (haystack.includes(kw)) return { taxCategoryId: cat.id, keyword: kw };
    }
  }
  return null;
}

/**
 * Baut die Liste offener Steuer-Vorschläge.
 * - nur Ausgaben (`amount < 0`), keine Transfers, noch nicht markiert
 * - Reihenfolge: (1) Kategorie-Default, (2) Keyword-Treffer, (3) steuerrelevant-Flag
 * - bereits entschiedene Vorschläge (angenommen/abgelehnt/ignoriert) fallen raus
 */
export function buildPendingTaxSuggestions(
  transactions: Transaction[],
  categories: Category[],
  decidedSuggestions: AutomationSuggestion[],
  limit = 50,
): AutomationSuggestion[] {
  const decidedById = new Map(decidedSuggestions.map((s) => [s.id, s.status]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const out: AutomationSuggestion[] = [];

  for (const tx of transactions) {
    if (!tx.id) continue;
    if (tx.tax_category_id) continue;
    if (tx.is_transfer) continue;
    if (tx.amount >= 0) continue;

    let taxCategoryId: string | null = null;
    let confidence = 0;
    let reason = '';

    // 1. Kategorie-Default (Unterkategorie vor Hauptkategorie).
    const cat = catById.get(tx.subcategory_id ?? '') ?? catById.get(tx.category_id ?? '');
    const def = cat?.attributes?.default_tax_category_id;
    if (def && taxCategoryById.has(def)) {
      taxCategoryId = def;
      confidence = TAX_CONFIDENCE.categoryDefault;
      reason = t('tax.suggestReason.categoryDefault', 'Kategorie „{category}" ist als {rubric} voreingestellt')
        .replace('{category}', cat?.name ?? '')
        .replace('{rubric}', rubricName(def));
    }

    // 2. Keyword-Treffer auf Empfänger + Verwendungszweck.
    if (!taxCategoryId) {
      const haystack = `${tx.payee} ${tx.description}`.toLowerCase();
      const hit = keywordMatch(haystack);
      if (hit) {
        taxCategoryId = hit.taxCategoryId;
        confidence = TAX_CONFIDENCE.keyword;
        reason = t('tax.suggestReason.keyword', 'Stichwort „{keyword}" erkannt').replace('{keyword}', hit.keyword);
      }
    }

    // 3. Kategorie ist steuerrelevant markiert, aber ohne Rubrik → Nutzer wählt.
    if (!taxCategoryId && cat?.attributes?.steuerrelevant) {
      confidence = TAX_CONFIDENCE.flagged;
      reason = t('tax.suggestReason.flagged', 'Als steuerrelevant markiert – Rubrik wählen');
    }

    if (confidence === 0) continue;

    const suggestion = buildTaxSuggestion(tx, taxCategoryId, [reason], confidence);
    const decided = decidedById.get(suggestion.id);
    if (decided && decided !== 'pending') continue;

    out.push(suggestion);
    if (out.length >= limit) break;
  }

  return out;
}
