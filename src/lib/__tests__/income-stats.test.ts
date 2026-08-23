import { describe, expect, it } from 'vitest';
import { durchschnittlichesMonatsEinkommen } from '../income-stats';
import { asTransactionId } from '@/lib/ids';
import type { Transaction } from '@/types';

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: asTransactionId('t'), user_id: 'local', account_id: 'a', date: '2026-08-01',
    amount: 2500, payee: 'Arbeitgeber', description: '', original_text: '',
    category_id: null, auto_mapped: false, confirmed: true,
    ...over,
  } as Transaction;
}

describe('durchschnittlichesMonatsEinkommen', () => {
  it('sollte über die letzten VOLLEN Monate mitteln — der laufende ist unvollständig', () => {
    // Stichtag 23.08.: Der August ist erst zu zwei Dritteln vorbei; ihn
    // mitzuzählen drückte den Schnitt systematisch nach unten.
    const einkommen = durchschnittlichesMonatsEinkommen(
      [
        tx({ id: asTransactionId('1'), date: '2026-07-28', amount: 2500 }),
        tx({ id: asTransactionId('2'), date: '2026-06-28', amount: 2500 }),
        tx({ id: asTransactionId('3'), date: '2026-05-28', amount: 2800 }),
        tx({ id: asTransactionId('4'), date: '2026-08-10', amount: 2500 }),
      ],
      new Date('2026-08-23T12:00:00Z'),
    );

    expect(einkommen).toBeCloseTo((2500 + 2500 + 2800) / 3);
  });

  it('sollte Ausgaben und Umbuchungen nicht als Einkommen zählen', () => {
    const einkommen = durchschnittlichesMonatsEinkommen(
      [
        tx({ id: asTransactionId('1'), date: '2026-07-10', amount: 2500 }),
        tx({ id: asTransactionId('2'), date: '2026-07-12', amount: -800 }),
        tx({ id: asTransactionId('3'), date: '2026-07-15', amount: 1000, is_transfer: true }),
      ],
      new Date('2026-08-23T12:00:00Z'),
    );

    expect(einkommen).toBeCloseTo(2500 / 3);
  });

  it('sollte ohne Einnahmen null liefern statt Null-Euro zu behaupten', () => {
    // „Kein Einkommen erfasst" ist eine ANDERE Aussage als „0 € Einkommen" —
    // dieselbe Unterscheidung wie überall im Register.
    expect(
      durchschnittlichesMonatsEinkommen([], new Date('2026-08-23T12:00:00Z')),
    ).toBeNull();
  });
});
