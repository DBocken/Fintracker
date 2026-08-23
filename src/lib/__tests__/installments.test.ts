import { describe, expect, it } from 'vitest';
import { erkenneRate, offeneRatenJeHaendler } from '../installments';
import { asTransactionId } from '@/lib/ids';
import type { Transaction } from '@/types';

/**
 * „Rate 3/12" im Verwendungszweck ist die einzige Stelle, an der ein
 * Kontoauszug die RESTLAUFZEIT einer Finanzierung verrät. Die App kannte den
 * Schuldentyp `installment` bislang nur als etwas, das der Nutzer selbst
 * auswählt — aus dem Text hat sie ihn nie gelesen.
 *
 * Gerechnet wird deterministisch: `12 − 3 = 9`. Erkannt wird nur, was ein
 * Kontextwort ausweist — „3/12" allein ist genauso gut ein Datum.
 */

describe('erkenneRate', () => {
  it('sollte die geläufige Schrägstrichform lesen', () => {
    expect(erkenneRate('KLARNA Ratenkauf 3/12')).toEqual(
      expect.objectContaining({ nummer: 3, gesamt: 12, offen: 9 }),
    );
  });

  it('sollte die ausgeschriebene Form lesen', () => {
    expect(erkenneRate('Ratenzahlung 2 von 6')).toEqual(
      expect.objectContaining({ nummer: 2, gesamt: 6, offen: 4 }),
    );
  });

  it('sollte führende Nullen und Groß-/Kleinschreibung vertragen', () => {
    expect(erkenneRate('rate 03/24 finanzierung')).toEqual(
      expect.objectContaining({ nummer: 3, gesamt: 24, offen: 21 }),
    );
  });

  it('sollte weitere übliche Bezeichnungen erkennen', () => {
    expect(erkenneRate('Teilzahlung 5/10')?.offen).toBe(5);
    expect(erkenneRate('Finanzierung Rate 1 von 48')?.offen).toBe(47);
  });

  it('sollte OHNE Kontextwort nichts erkennen', () => {
    // „3/12" ist genauso gut der 3. Dezember, ein Bruch oder eine
    // Belegnummer. Ohne ein Wort, das von Raten spricht, wird nicht geraten —
    // eine erfundene Restlaufzeit wäre schlimmer als gar keine.
    expect(erkenneRate('Lastschrift 3/12')).toBeNull();
    expect(erkenneRate('Rechnung vom 3/12')).toBeNull();
    expect(erkenneRate('REWE SAGT DANKE 12,50')).toBeNull();
  });

  it('sollte unsinnige Verhältnisse abweisen', () => {
    expect(erkenneRate('Rate 13/12')).toBeNull();
    expect(erkenneRate('Rate 0/12')).toBeNull();
    expect(erkenneRate('Rate 3/1')).toBeNull();
    // Eine dreistellige Ratenzahl ist keine Finanzierung, sondern ein Datum
    // oder eine Belegnummer, die zufällig neben dem Wort steht.
    expect(erkenneRate('Rate 3/500')).toBeNull();
  });

  it('sollte die letzte Rate als abbezahlt ausweisen', () => {
    expect(erkenneRate('Ratenkauf 12/12')?.offen).toBe(0);
  });
});

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: asTransactionId('tx'), user_id: 'local', account_id: 'a', date: '2026-08-01',
    amount: -49.9, payee: 'KLARNA', description: '', original_text: '',
    category_id: null, auto_mapped: false, confirmed: true,
    ...over,
  } as Transaction;
}

describe('offeneRatenJeHaendler', () => {
  it('sollte je Händler die JÜNGSTE Rate zählen, nicht die Summe aller Funde', () => {
    // Jede Buchung derselben Finanzierung trägt einen Ratenhinweis. Sie zu
    // addieren ergäbe „noch 9+10+11 Raten" — die Auskunft steht in der
    // NEUESTEN Buchung, alle älteren sind überholt.
    const buchungen = [
      tx({ id: asTransactionId('1'), date: '2026-06-01', description: 'Ratenkauf 1/12' }),
      tx({ id: asTransactionId('2'), date: '2026-07-01', description: 'Ratenkauf 2/12' }),
      tx({ id: asTransactionId('3'), date: '2026-08-01', description: 'Ratenkauf 3/12' }),
    ];

    const raten = offeneRatenJeHaendler(buchungen);
    expect(raten).toHaveLength(1);
    expect(raten[0].offen).toBe(9);
    expect(raten[0].monatlich).toBeCloseTo(49.9);
  });

  it('sollte zwei Finanzierungen desselben Händlers über die Ratenzahl trennen', () => {
    const buchungen = [
      tx({ id: asTransactionId('1'), date: '2026-08-01', description: 'Ratenkauf 3/12', amount: -49.9 }),
      tx({ id: asTransactionId('2'), date: '2026-08-01', description: 'Ratenkauf 2/6', amount: -20 }),
    ];

    expect(offeneRatenJeHaendler(buchungen)).toHaveLength(2);
  });

  it('sollte eine abgeschlossene Finanzierung nicht mehr ausweisen', () => {
    const buchungen = [tx({ description: 'Ratenkauf 12/12' })];
    expect(offeneRatenJeHaendler(buchungen)).toHaveLength(0);
  });

  it('sollte Buchungen ohne Ratenhinweis übergehen', () => {
    expect(offeneRatenJeHaendler([tx({ description: 'REWE' })])).toHaveLength(0);
  });
});
