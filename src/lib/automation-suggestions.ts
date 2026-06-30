// Reiner Produzent für Kategorie-Vorschläge (Issue: „Automatisch, aber nie
// bevormundend"): erzeugt aus NICHT zugeordneten Buchungen Vorschläge statt
// stiller Änderungen. Der Nutzer entscheidet (annehmen/ablehnen) — die
// Entscheidung wird persistiert, damit ein Vorschlag nicht wiederkehrt.
//
// On-demand & rein: berechnet aus vorhandenen Daten, ohne die Import-Pipeline
// zu berühren. Die einzige Mutation passiert erst, wenn der Nutzer annimmt.

import { explainCategorization } from "@/services/transaction-service";
import { buildCategorySuggestionFromResult } from "@/services/automation-suggestion-service";
import type { AutomationSuggestion } from "@/services/automation-suggestion-service";
import type { Category, Transaction } from "@/types";
import type { MerchantRule } from "@/services/merchant-rules-service";

/** Schwächste Confidence, die wir noch als Vorschlag zeigen (Regex-Fallback = 0,55). */
export const MIN_SUGGEST_CONFIDENCE = 0.5;

export type SuggestionConfidenceLevel = "hoch" | "mittel" | "niedrig";

/** Übersetzt die Heuristik-Confidence in eine erklärbare Sicherheitsstufe. */
export function suggestionConfidenceLevel(confidence: number): SuggestionConfidenceLevel {
  if (confidence >= 0.85) return "hoch";
  if (confidence >= 0.7) return "mittel";
  return "niedrig";
}

/**
 * Baut die Liste offener Kategorie-Vorschläge.
 * - nur NICHT zugeordnete Buchungen (kein `category_id`)
 * - keine Transfers (die bekommen keine Ausgaben-Kategorie)
 * - nur Treffer ab {@link MIN_SUGGEST_CONFIDENCE}
 * - bereits entschiedene Vorschläge (angenommen/abgelehnt/ignoriert) fallen raus
 */
export function buildPendingCategorySuggestions(
  transactions: Transaction[],
  categories: Category[],
  learnedRules: MerchantRule[],
  decidedSuggestions: AutomationSuggestion[],
  limit = 20,
): AutomationSuggestion[] {
  const decidedById = new Map(decidedSuggestions.map((s) => [s.id, s.status]));
  const out: AutomationSuggestion[] = [];

  for (const tx of transactions) {
    if (!tx.id) continue;
    if (tx.category_id) continue;
    if (tx.is_transfer) continue;

    const result = explainCategorization(tx, categories, learnedRules);
    if (!result.categoryId || result.confidence < MIN_SUGGEST_CONFIDENCE) continue;

    const suggestion = buildCategorySuggestionFromResult(tx, result);
    if (!suggestion) continue;

    const decided = decidedById.get(suggestion.id);
    if (decided && decided !== "pending") continue;

    out.push(suggestion);
    if (out.length >= limit) break;
  }

  return out;
}
