import { describe, expect, it } from 'vitest';
import { monatlicheFixkosten } from '../fixed-costs';
import type { ContractRow } from '../contract-types';

/**
 * Die KANONISCHE Fixkosten-Definition — bislang gab es keine: Jede Fläche,
 * die „Fixkosten" sagte, meinte etwas leicht anderes. Definiert ist:
 * Monatsäquivalente aller AKTIVEN Ausgabe-Verträge (`isActiveForTotals`,
 * dieselbe Regel, mit der der Forecast Verträge zählt). Die Antwort im Chat
 * nennt diese Definition mit — eine Zahl ohne einsehbare Definition wäre
 * eine Behauptung.
 */

function zeile(over: Partial<ContractRow>): ContractRow {
  return {
    key: 'k', type: 'Ausgabe', payee: 'Anbieter', categoryName: '', categoryId: null,
    amountTypical: -12.99, amountLast: -12.99, cycle: 'Monatlich',
    lastDateISO: '2026-08-01', firstDateISO: '2026-01-01', nextDateISO: '2026-09-01',
    changed: false, changeAmount: 0, changeSinceLabel: null, confirmed: true,
    transactionIds: [], fingerprint: 'fp', status: 'active', stale: false, cycleKnown: true,
    ...over,
  } as ContractRow;
}

describe('monatlicheFixkosten', () => {
  it('sollte Monatsäquivalente aktiver Ausgabe-Verträge summieren', () => {
    const { summe, anzahl } = monatlicheFixkosten([
      zeile({ amountTypical: -12.99, cycle: 'Monatlich' }),
      zeile({ key: 'k2', fingerprint: 'fp2', amountTypical: -120, cycle: 'Jährlich' }),
    ]);

    expect(summe).toBeCloseTo(12.99 + 10);
    expect(anzahl).toBe(2);
  });

  it('sollte beendete, veraltete und zyklus-unbekannte Verträge auslassen', () => {
    // Dieselbe Regel wie im Forecast (`isActiveForTotals`) — zwei
    // verschiedene Fixkosten-Begriffe in einer App wären schlimmer als gar
    // keiner.
    const { summe, anzahl } = monatlicheFixkosten([
      zeile({}),
      zeile({ key: 'a', status: 'ended' }),
      zeile({ key: 'b', stale: true }),
      zeile({ key: 'c', cycleKnown: false }),
      zeile({ key: 'd', type: 'Einnahme', amountTypical: 2500 }),
    ]);

    expect(anzahl).toBe(1);
    expect(summe).toBeCloseTo(12.99);
  });

  it('sollte den JÜNGEREN typischen Betrag bevorzugen, wenn er vorliegt', () => {
    const { summe } = monatlicheFixkosten([
      zeile({ amountTypical: -9.99, amountRecentTypical: -14.99 }),
    ]);
    expect(summe).toBeCloseTo(14.99);
  });

  it('sollte ohne Verträge Null mit Anzahl Null liefern', () => {
    expect(monatlicheFixkosten([])).toEqual({ summe: 0, anzahl: 0 });
  });
});
