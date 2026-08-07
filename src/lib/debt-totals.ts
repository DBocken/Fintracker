/**
 * Summen über Schuldenstände — centgenau (AGENTS.md §8).
 *
 * Lagen zuvor als `getTotalDebt`/`getTotalMinPayment` im `debt-service`. Sie
 * machen kein I/O; der Service besitzt sie also nicht, er benutzt sie nur.
 * Wichtiger als der Ort ist aber das Rechnen: beide summierten roh über
 * Float-Euro. Der zugehörige Test prüfte mit `toBeCloseTo` — „ungefähr 0,30"
 * gilt dort als bestanden, und genau deshalb ist nie aufgefallen, dass der
 * Gesamtstand um Bruchteile eines Cents daneben liegen kann.
 */
import type { Debt } from "@/types";
import { sumMinor, toMajor, toMinor } from "@/lib/money";

/** Nur nicht abbezahlte Schulden zählen; negative Werte sind keine Schuld. */
function activeAmounts(debts: Debt[], pick: (debt: Debt) => number): number[] {
  return debts.filter((debt) => !debt.is_paid_off).map((debt) => toMinor(Math.max(0, pick(debt))));
}

/** Summe aller offenen Schuldenstände in Euro. */
export function totalOutstandingDebt(debts: Debt[]): number {
  return toMajor(sumMinor(activeAmounts(debts, (debt) => debt.balance)));
}

/** Summe aller Mindestraten offener Schulden in Euro. */
export function totalMinimumPayment(debts: Debt[]): number {
  return toMajor(sumMinor(activeAmounts(debts, (debt) => debt.min_payment)));
}
