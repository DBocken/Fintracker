import { describe, expect, it } from 'vitest';
import { questionCatalog } from '@/features/money-questions/data/question-catalog';
import { asTransactionId } from '@/lib/ids';
import type { QuestionData } from '@/lib/question-registry';
import type { Transaction } from '@/types';
import type { ContractDecision } from '@/lib/contract-types';
import { computeContracts } from '@/lib/contract-derivation';

/**
 * `abbuchung.naechste` (Welle 3) — was in den nächsten 30 Tagen vom Konto
 * geht. Gerechnet mit `computeContracts` + `getUpcomingCharges`, also mit
 * derselben Liste, die der Coach und die Liquiditätsfläche zeigen.
 */

const JETZT = new Date('2026-08-20T12:00:00Z');

let lfd = 0;
function tx(datum: string, betrag: number, payee: string): Transaction {
  lfd += 1;
  return {
    id: asTransactionId(`ab-${lfd}`),
    date: datum,
    amount: betrag,
    payee,
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
  } as Transaction;
}

/**
 * Drei gleiche Monatsbuchungen plus die BESTÄTIGUNG.
 *
 * Die Bestätigung ist kein Testbeiwerk, sondern Bestandsverhalten:
 * `buildRecurringFlows` nimmt eine Ausgabe nur, wenn der Nutzer den erkannten
 * Vertrag bestätigt hat (`isActiveForTotals`). Ein blosser Verdacht darf die
 * Prognose nicht bewegen — und der Chat erbt diese Zurückhaltung, statt sich
 * eine eigene zu geben.
 */
function vertragsDaten(): QuestionData {
  const buchungen = [
    tx('2026-06-01', -12.99, 'NETFLIX'),
    tx('2026-07-01', -12.99, 'NETFLIX'),
    tx('2026-08-01', -12.99, 'NETFLIX'),
  ];
  const zeilen = computeContracts(buchungen, new Map(), 'Ausgabe', { now: JETZT });
  const entscheidungen = new Map(
    zeilen.map((z) => [
      z.key,
      // `active`, nicht `confirmed`: `isActiveForTotals` verlangt genau
      // diesen Status — nur ein aktiver, nicht veralteter Vertrag mit
      // bekanntem Zyklus bewegt die Prognose.
      { id: `d-${z.key}`, user_id: 'local', fingerprint: z.key, status: 'active' } as ContractDecision,
    ]),
  );
  return { transactions: buchungen, categories: [], contractDecisions: entscheidungen, jetzt: JETZT };
}

describe('abbuchung.naechste', () => {
  const eintrag = questionCatalog.byId('abbuchung.naechste')!;

  it('sollte fällige Abbuchungen der nächsten 30 Tage listen', () => {
    // Aus drei monatlichen Buchungen leitet `computeContracts` einen Vertrag
    // ab; `getUpcomingCharges` legt seine nächste Fälligkeit ins Fenster.
    const antwort = eintrag.antwort({}, vertragsDaten());
    expect(antwort.art).toBe('liste');
    expect(antwort.anzahl).toBeGreaterThan(0);
    expect(antwort.posten?.[0]?.betrag).toBeGreaterThan(0);
  });

  it('sollte ohne erkannten Vertrag eine ZAHL nennen statt zu schweigen', () => {
    // „Ich sehe nichts" ist eine Antwort; Schweigen sähe aus wie „nicht
    // verstanden".
    const antwort = eintrag.antwort({}, { transactions: [], categories: [], jetzt: new Date('2026-08-20T12:00:00Z') });
    expect(antwort.art).toBe('anzahl');
    expect(antwort.wert).toBe(0);
  });
});
