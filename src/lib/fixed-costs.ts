/**
 * Die kanonische Fixkosten-Definition der App.
 *
 * > **Fixkosten = Summe der Monatsäquivalente aller aktiven Ausgabe-Verträge.**
 *
 * „Aktiv" heisst `isActiveForTotals`: Status aktiv, nicht veraltet, Zyklus
 * bekannt — exakt die Regel, mit der auch der Forecast Verträge zählt
 * (`services/forecast-data.ts`). Zwei verschiedene Fixkosten-Begriffe in
 * einer App wären schlimmer als gar keiner: Der Chat nennt eine Zahl, der
 * Forecast eine andere, und beide heissen gleich.
 *
 * Vor dieser Datei gab es KEINE benannte Definition — jede Fläche, die
 * „Fixkosten" sagte, rechnete ad hoc. Wer die Definition ändert, ändert sie
 * hier für alle; die Chat-Antwort nennt sie ausdrücklich mit
 * (`financeQuestions.reason.fixkostenDefinition`), weil eine Zahl ohne
 * einsehbare Definition eine Behauptung ist.
 */
import { isActiveForTotals, monthlyEquivalent } from '@/lib/contract-derivation';
import type { ContractRow } from '@/lib/contract-types';

export interface Fixkosten {
  /** Monatliche Summe, positiv. */
  summe: number;
  /** Wie viele Verträge dahinter stehen. */
  anzahl: number;
}

export function monatlicheFixkosten(zeilen: readonly ContractRow[]): Fixkosten {
  let summe = 0;
  let anzahl = 0;
  for (const zeile of zeilen) {
    if (zeile.type !== 'Ausgabe' || !isActiveForTotals(zeile)) continue;
    const betrag = zeile.amountRecentTypical ?? zeile.amountTypical;
    summe += Math.abs(monthlyEquivalent(betrag, zeile.cycle));
    anzahl += 1;
  }
  return { summe, anzahl };
}
