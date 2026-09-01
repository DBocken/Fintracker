import { describe, expect, it } from 'vitest';
import { buildCsvContentKey, createOccurrenceCounter } from '@/lib/transaction-identity';

describe('buildCsvContentKey', () => {
  it('sollte für dieselbe Buchung denselben Schlüssel liefern, egal woher sie kommt', () => {
    const a = buildCsvContentKey({ date: '2026-01-05', amount: -49.99, payee: 'NETFLIX', description: 'Abo', currency: 'EUR', counterparty_iban: null });
    const b = buildCsvContentKey({ date: '2026-01-05', amount: '-49.99', payee: ' NETFLIX ', description: 'Abo', currency: 'EUR', counterparty_iban: null });
    expect(a).toBe(b);
  });

  it('sollte zwei verschiedene Buchungen unterscheiden', () => {
    const a = buildCsvContentKey({ date: '2026-01-05', amount: -49.99, payee: 'NETFLIX' });
    const b = buildCsvContentKey({ date: '2026-01-05', amount: -49.98, payee: 'NETFLIX' });
    expect(a).not.toBe(b);
  });
});

describe('createOccurrenceCounter', () => {
  it('sollte gleiche Inhalte durchzählen und verschiedene bei null beginnen', () => {
    const zaehle = createOccurrenceCounter();
    const zeile = { date: '2026-01-05', amount: -3, payee: 'BÄCKER' };

    expect(zaehle(zeile)).toBe(0);
    expect(zaehle(zeile)).toBe(1);
    expect(zaehle({ ...zeile, amount: -4 })).toBe(0);
  });
});
