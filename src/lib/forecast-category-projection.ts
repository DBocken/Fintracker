/**
 * WP-5.2 — Erwartete Ausgaben je Kategorie und Monat.
 *
 * Die Finanzstadt soll einen Zukunftsmonat zeigen können. Dafür braucht sie
 * je Gebäude (= Kategorie) einen erwarteten Monatsbetrag — und genau den
 * berechnet der Forecast bereits, nur nicht in dieser Zusammenfassung:
 *
 * - `buildRecurringFlows` kennt die Verträge samt Rhythmus,
 * - `buildVariableExpenseBaselines` kennt den variablen Konsum je Kategorie,
 * - `listFlowOccurrences` kennt die Fälligkeitstermine eines Rhythmus.
 *
 * Diese Datei fasst das nur zusammen. Sie rechnet NICHTS neu — insbesondere
 * keine eigene Zyklus-Mathematik („Jahresbetrag / 12" wäre falsch: eine
 * Quartalszahlung ist in drei von vier Monaten nicht da) und keine eigene
 * Baseline. Eine zweite Prognose neben dem Cashflow-Forecast, die diesem
 * widersprechen kann, ist genau das, was hier vermieden wird.
 *
 * Verschlüsselt wird über die Kategorie-**ID**. AGENTS.md §6 führt das
 * Matching über den Anzeigenamen als dokumentierte Falle: es bricht bei
 * Umbenennung und in jeder anderen Sprache. Einträge ohne ID werden deshalb
 * übersprungen — lieber keine Prognose für eine Kategorie als eine, die dem
 * falschen Gebäude zugeschlagen wird.
 *
 * Reine Funktion ohne IO (wie der Rest der Forecast-Schicht).
 */

import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { listFlowOccurrences } from './forecast';
import type { RecurringFlow, VariableExpenseBaseline } from './forecast-types';

export type CategoryProjectionInput = {
  /** Wiederkehrende Zahlungen — dieselben, die in den Forecast einfließen. */
  recurringFlows: RecurringFlow[];
  /** Variable Ausgaben-Baselines je Kategorie. */
  variableExpenses: VariableExpenseBaseline[];
};

const ISO = 'yyyy-MM-dd';
const MONTH_KEY = /^\d{4}-\d{2}$/;

/**
 * Der für einen Monat anzusetzende Baseline-Betrag. Reihenfolge wie im
 * Forecast selbst: ein konkreter Monatsplan schlägt den Budget-Override, und
 * der schlägt den historischen Mittelwert (Budget-Semantik: der Plan ERSETZT
 * die Historie, er begrenzt sie nicht).
 */
function baselineAmountForMonth(baseline: VariableExpenseBaseline, monthKey: string): number {
  const planned = baseline.monthlyAmounts?.[monthKey];
  if (planned !== undefined) return planned;
  if (baseline.budgetOverride !== undefined) return baseline.budgetOverride;
  return baseline.monthlyAmount;
}

/**
 * Erwartete AUSGABEN je Kategorie-ID im angegebenen Monat (`yyyy-MM`).
 * Beträge sind positiv (wie überall im Stadt-Modell); Einnahmen fließen nicht
 * ein, weil die Ausgabenstadt sie nicht abbildet.
 *
 * Kategorien ohne erwartete Ausgabe fehlen im Ergebnis — ein `0` würde eine
 * geprüfte Aussage behaupten, wo schlicht keine Datengrundlage vorliegt.
 */
export function projectCategorySpend(
  input: CategoryProjectionInput,
  monthKey: string,
): Map<string, number> {
  const result = new Map<string, number>();
  if (!MONTH_KEY.test(monthKey)) return result;

  const monthStart = parseISO(`${monthKey}-01`);
  if (Number.isNaN(monthStart.getTime())) return result;
  const startISO = format(startOfMonth(monthStart), ISO);
  const endISO = format(endOfMonth(monthStart), ISO);

  const add = (categoryId: string | undefined, amount: number) => {
    if (!categoryId || !(amount > 0)) return;
    result.set(categoryId, (result.get(categoryId) ?? 0) + amount);
  };

  for (const flow of input.recurringFlows) {
    // Nur Abflüsse: die Ausgabenstadt bildet keine Einnahmen ab.
    if (flow.amount >= 0) continue;
    const occurrences = listFlowOccurrences(flow, startISO, endISO);
    if (occurrences.length === 0) continue;
    add(flow.categoryId, Math.abs(flow.amount) * occurrences.length);
  }

  for (const baseline of input.variableExpenses) {
    add(baseline.categoryId, baselineAmountForMonth(baseline, monthKey));
  }

  return result;
}
