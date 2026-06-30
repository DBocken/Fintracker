// Prioritäts-Wasserfall fürs Budget-Optimieren: „Wo zuerst sparen?"
//
// Idee (Nutzer-Modell): Ausgaben mit NIEDRIGER Priorität werden zuerst gekürzt –
// das Nice-to-have geht vor dem Normalen, das Essenzielle bleibt unangetastet.
// Es wird so lange (pro Kategorie bis zur realistischen Kürzungsgrenze)
// gekürzt, bis das monatliche Sparziel erreicht ist. Erst wenn eine ganze
// Prioritätsstufe ausgeschöpft ist, wird die nächste angefasst.

import type { Prioritaet } from "@/types";

export interface PriorityCutItem {
  category: string;
  /** Aktueller Monatsbetrag (positive Zahl). */
  monthlyAmount: number;
  /** Realistisch kürzbarer Höchstbetrag pro Monat (z. B. Volatilität × Betrag). */
  maxCut: number;
  prioritaet?: Prioritaet | null;
}

export interface PriorityCutSuggestion {
  category: string;
  monthlyAmount: number;
  suggestedCut: number;
  newBudget: number;
  prioritaet: Prioritaet;
  /** Summe der Kürzungen bis einschließlich dieser Position. */
  cumulativeCut: number;
}

export interface PriorityCutPlan {
  suggestions: PriorityCutSuggestion[];
  totalCut: number;
  targetReached: boolean;
  /** Essenzielle Kategorien, die bewusst NICHT gekürzt werden. */
  protectedCategories: string[];
}

/** Niedrig zuerst: nice (0) → normal (1). essential ist geschützt (nie gekürzt). */
const RANK: Record<Prioritaet, number> = { nice: 0, normal: 1, essential: 2 };

/** Fehlt die Priorität, gilt „normal" (sicherer Mittelwert). */
export function resolvePrioritaet(p?: Prioritaet | null): Prioritaet {
  return p ?? "normal";
}

/**
 * Baut den Spar-Wasserfall. `monthlyTarget` = benötigte Einsparung pro Monat;
 * bei ≤ 0 wird das volle Kürzungspotenzial (nach Priorität sortiert) gezeigt.
 */
export function computePriorityCutPlan(
  items: PriorityCutItem[],
  monthlyTarget: number,
): PriorityCutPlan {
  const protectedCategories: string[] = [];
  const cuttable = items
    .map((it) => ({ ...it, prioritaet: resolvePrioritaet(it.prioritaet) }))
    .filter((it) => {
      if (it.prioritaet === "essential") {
        protectedCategories.push(it.category);
        return false;
      }
      return it.monthlyAmount > 0 && it.maxCut > 0;
    })
    // Niedrigste Priorität zuerst; innerhalb gleicher Stufe größeres Sparpotenzial zuerst.
    .sort((a, b) => RANK[a.prioritaet] - RANK[b.prioritaet] || b.maxCut - a.maxCut);

  const hasTarget = monthlyTarget > 0;
  let remaining = hasTarget ? monthlyTarget : Infinity;
  let cumulative = 0;
  const suggestions: PriorityCutSuggestion[] = [];

  for (const it of cuttable) {
    if (hasTarget && remaining <= 0) break;
    const cut = hasTarget ? Math.min(it.maxCut, Math.round(remaining)) : it.maxCut;
    if (cut <= 0) continue;
    remaining -= cut;
    cumulative += cut;
    suggestions.push({
      category: it.category,
      monthlyAmount: it.monthlyAmount,
      suggestedCut: cut,
      newBudget: Math.max(0, it.monthlyAmount - cut),
      prioritaet: it.prioritaet,
      cumulativeCut: cumulative,
    });
  }

  return {
    suggestions,
    totalCut: cumulative,
    targetReached: hasTarget ? cumulative + 1e-6 >= monthlyTarget : true,
    protectedCategories,
  };
}
