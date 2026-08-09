import { describe, it, expect } from 'vitest';
import type { SpecialCategory, SpecialCategoryAssignment, Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { assignmentCostMinor, computeEventTotals } from '../event-totals';

let txSeq = 0;
function tx(amount: number, over: Omit<Partial<Transaction>, 'id'> & { id?: string } = {}): Transaction {
  txSeq += 1;
  return {
    date: '2026-09-05',
    amount,
    payee: 'P',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...over,
    id: asTransactionId(over.id ?? `tx-${txSeq}`),
  };
}

let asgSeq = 0;
function asg(
  special_category_id: string,
  transaction_id: string,
  over: Partial<SpecialCategoryAssignment> = {},
): SpecialCategoryAssignment {
  asgSeq += 1;
  return {
    id: `asg-${asgSeq}`,
    special_category_id,
    transaction_id,
    source: 'manual',
    ...over,
  };
}

const cats: SpecialCategory[] = [
  { id: 'hochzeit', name: 'Hochzeit', parent_id: null },
  { id: 'flitter', name: 'Flitterwochen', parent_id: 'hochzeit' },
];

describe('Anlass-Summen', () => {
  it('sollte eine ganze Ausgabe voll dem Anlass zurechnen (S2)', () => {
    const restaurant = tx(-45); // -45,00 €
    const totals = computeEventTotals(cats, [asg('flitter', restaurant.id!)], [restaurant]);
    expect(totals.get('flitter')!.ownMinor).toBe(4500);
    expect(totals.get('flitter')!.transactionCount).toBe(1);
  });

  it('sollte im Parent den ganzen Teilbaum aggregieren (S3)', () => {
    const eigen = tx(-8000);
    const kind = tx(-4230);
    const totals = computeEventTotals(
      cats,
      [asg('hochzeit', eigen.id!), asg('flitter', kind.id!)],
      [eigen, kind],
    );
    expect(totals.get('hochzeit')!.ownMinor).toBe(800000);
    expect(totals.get('hochzeit')!.subtreeMinor).toBe(1223000); // 8000 + 4230
    expect(totals.get('flitter')!.subtreeMinor).toBe(423000);
  });

  it('sollte einen Teilbetrag einer Buchung zuordnen (S4, Trinkgeld)', () => {
    const abhebung = tx(-100); // -100,00 € Barabhebung
    const totals = computeEventTotals(
      cats,
      [asg('flitter', abhebung.id!, { amount_minor: 2000 })], // 20,00 €
      [abhebung],
    );
    expect(totals.get('flitter')!.ownMinor).toBe(2000);
  });

  it('sollte eine zugeordnete Erstattung die Summe mindern lassen (S5)', () => {
    const ausgabe = tx(-4230);
    const storno = tx(120, { payee: 'Storno Reiseversicherung' }); // +120,00 €
    const totals = computeEventTotals(
      cats,
      [asg('flitter', ausgabe.id!), asg('flitter', storno.id!)],
      [ausgabe, storno],
    );
    expect(totals.get('flitter')!.ownMinor).toBe(411000); // 4230 - 120
  });

  it('sollte den Teilbetrag einer Erstattung mit negativem Vorzeichen anrechnen', () => {
    const gutschrift = tx(200);
    expect(assignmentCostMinor(asg('flitter', gutschrift.id!, { amount_minor: 5000 }), new Map([[gutschrift.id!, gutschrift]]))).toBe(-5000);
  });

  it('sollte robust bleiben, wenn die Buchung fehlt (verwaiste Zuordnung)', () => {
    const totals = computeEventTotals(cats, [asg('flitter', 'weg')], []);
    expect(totals.get('flitter')!.ownMinor).toBe(0);
    // transactionCount zählt Zuordnungen, nicht existierende Buchungen.
    expect(totals.get('flitter')!.transactionCount).toBe(1);
  });

  it('sollte alles in Integer-Cent rechnen (keine Float-Drift)', () => {
    const a = tx(-19.99);
    const b = tx(-0.1);
    const c = tx(-0.2);
    const totals = computeEventTotals(
      cats,
      [asg('flitter', a.id!), asg('flitter', b.id!), asg('flitter', c.id!)],
      [a, b, c],
    );
    expect(totals.get('flitter')!.ownMinor).toBe(1999 + 10 + 20);
    expect(Number.isInteger(totals.get('flitter')!.ownMinor)).toBe(true);
  });
});
