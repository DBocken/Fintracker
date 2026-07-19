import type { ReplacementPlan } from '@/lib/schemas/replacement-plan.schema';

/**
 * Zyklus-Neustart nach einem TATSÄCHLICH bestätigten Ersatz (Slice A5, #243).
 * Rein — der Aufrufer persistiert das Ergebnis. Wird bewusst nur auf explizite
 * Nutzerbestätigung angewendet (nicht automatisch innerhalb eines Forecast-Laufs).
 *
 * ERWEITERUNGSPUNKT Reparaturen/Lebensdauerverlängerung: Eine Reparatur würde den
 * Ersatztermin nach hinten schieben, ohne den Zyklus neu zu starten. Das ist hier
 * bewusst NICHT implementiert — der Neustart bleibt auf den echten Ersatz
 * beschränkt. Ein späteres Issue kann eine `extendLifespan(plan, months)`-Funktion
 * ergänzen, ohne dieses Modell zu brechen.
 */

export interface ReplacementConfirmation {
  /** Datum des tatsächlichen Ersatzes (ISO yyyy-mm-dd) — neues Kaufdatum. */
  replacementDate: string;
  /** Tatsächlich gezahlter Preis in Cent — neue Preisbasis des Folgezyklus. */
  actualCostMinor?: number;
  /** Reale Ersatz-Transaktion (typisierte FK, statisches Ziel). */
  transactionId?: string;
  /** Über die Rücklage hinausgehenden Rest in den neuen Zyklus übernehmen? */
  carryReserveRemainder?: boolean;
}

/**
 * Startet den Rücklagenzyklus neu: das bestätigte Ersatzdatum wird zum neuen
 * Kaufdatum, der gezahlte Preis zur neuen Preisbasis, die Rücklage auf 0 (oder
 * den übernommenen Rest) gesetzt, ein fixer Alttermin entfernt (der neue Termin
 * wird aus Kaufdatum + Lebensdauer neu abgeleitet) und `cycle_count` erhöht.
 */
export function restartReplacementCycle(
  plan: ReplacementPlan,
  confirmation: ReplacementConfirmation,
): ReplacementPlan {
  const newCostMinor = confirmation.actualCostMinor ?? plan.replacement_cost_minor;
  const remainderMinor = confirmation.carryReserveRemainder
    ? Math.max(0, plan.reserve_minor - newCostMinor)
    : 0;

  return {
    ...plan,
    replacement_cost_minor: newCostMinor,
    purchase_date: confirmation.replacementDate,
    // Fixtermin des alten Zyklus entfernen — der neue Termin ergibt sich aus
    // Kaufdatum + Lebensdauer (resolveReplacementDate).
    planned_replacement_date: undefined,
    remaining_lifespan_months: undefined,
    reserve_minor: remainderMinor,
    last_replacement_transaction_id:
      confirmation.transactionId ?? plan.last_replacement_transaction_id,
    cycle_count: (plan.cycle_count ?? 0) + 1,
  };
}
