/**
 * Reine Auswertungen der Schulden-Fläche.
 *
 * Alles hier lag zuvor als `useMemo` in `DebtsPage.tsx` und war damit nur über
 * einen gerenderten Screen prüfbar. Zwei der drei Funktionen haben dabei
 * gerechnet, wie AGENTS.md §8 es ausdrücklich verbietet — siehe die
 * [REGRESSION]-Tests daneben.
 */
import type { Debt } from "@/types";
import type { DebtTransactionAssignment } from "@/lib/debt-types";
import { parseGermanNumber, sumMinor, toMajor, toMinor, type Cents } from "@/lib/money";

/** Ein Posten der Aufschlüsselung „woher kommen die Schulden". */
export interface DebtCause {
  label: string;
  amount: number;
  /** Anteil am Gesamtstand in ganzen Prozent. */
  pct: number;
}

/**
 * Liest die freiwillige Zusatztilgung aus dem Eingabefeld.
 *
 * Bewusst `parseGermanNumber` und nicht `parseEuroInput`: Das Feld wird beim
 * Tippen ausgewertet, ein halb eingegebener Betrag darf keinen Fehler werfen.
 * Und bewusst nicht `parseFloat` — das las „1.200" als 1,2 und „12,50" als 12
 * und verfälschte damit still sowohl den Tilgungsplan als auch die
 * Überschuldungs-Heuristik, die daneben über das Beratungsangebot entscheidet.
 */
export function parseExtraBudget(input: string | number | null | undefined): number {
  return parseGermanNumber(input) ?? 0;
}

/** Summe der einer Schuld zugeordneten Buchungen, centgenau. */
export function sumAssignedAmounts(assignments: DebtTransactionAssignment[]): number {
  return toMajor(sumMinor(assignments.map((assignment) => toMinor(Number(assignment.amount)))));
}

/**
 * Schlüsselt die offenen Schulden nach Art auf — bei „Buy now, pay later" nach
 * Anbieter, weil „Ratenkauf" dort nichts unterscheidet.
 *
 * `labels` kommt von außen (i18n), damit diese Funktion sprachfrei bleibt.
 */
export function summarizeDebtCauses(debts: Debt[], labels: Record<string, string>): DebtCause[] {
  const active = debts.filter((debt) => !debt.is_paid_off && debt.balance > 0);
  const totalMinor = sumMinor(active.map((debt) => toMinor(debt.balance)));
  if (totalMinor <= 0) return [];

  const byLabelMinor = new Map<string, Cents>();
  for (const debt of active) {
    const label = debt.is_bnpl ? debt.provider || labels.installment : labels[debt.type];
    byLabelMinor.set(label, ((byLabelMinor.get(label) ?? 0) + toMinor(debt.balance)) as Cents);
  }

  return [...byLabelMinor.entries()]
    .map(([label, minor]) => ({
      label,
      amount: toMajor(minor),
      pct: Math.round((minor / totalMinor) * 100),
    }))
    .sort((a, b) => b.amount - a.amount);
}
