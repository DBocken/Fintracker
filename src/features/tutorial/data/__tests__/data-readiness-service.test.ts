import { describe, it, expect } from 'vitest';
import {
  countCategorizedMonths,
  countMonthsOfHistory,
  hasRecurringCandidate,
} from '../data-readiness-service';
import type { Transaction } from '@/types';

function tx(date: string, amount: number, extra: Partial<Transaction> = {}): Transaction {
  return { id: `${date}-${amount}-${extra.payee ?? ''}`, date, amount, ...extra } as Transaction;
}

describe('countMonthsOfHistory', () => {
  it('sollte Monate zählen, nicht Buchungen', () => {
    expect(
      countMonthsOfHistory([tx('2026-01-05', -10), tx('2026-01-20', -10), tx('2026-02-01', -10)]),
    ).toBe(2);
  });

  it('sollte ohne Buchungen null Monate melden', () => {
    expect(countMonthsOfHistory([])).toBe(0);
  });
});

describe('countCategorizedMonths', () => {
  it('sollte einen überwiegend zugeordneten Monat zählen', () => {
    expect(
      countCategorizedMonths([
        tx('2026-01-01', -10, { category_id: 'c1' }),
        tx('2026-01-02', -10, { category_id: 'c1' }),
        tx('2026-01-03', -10),
      ]),
    ).toBe(1);
  });

  it('sollte einen überwiegend offenen Monat nicht zählen', () => {
    expect(
      countCategorizedMonths([
        tx('2026-01-01', -10, { category_id: 'c1' }),
        tx('2026-01-02', -10),
        tx('2026-01-03', -10),
      ]),
    ).toBe(0);
  });

  it('sollte einen einzelnen offenen Betrag den Monat nicht entwerten lassen', () => {
    // Die Stadt und das Flussdiagramm sind auch dann schon eine Aussage —
    // „genug zugeordnet" statt „alles zugeordnet".
    const month = Array.from({ length: 9 }, (_, i) =>
      tx(`2026-01-0${i + 1}`, -10, { category_id: 'c1' }),
    );
    expect(countCategorizedMonths([...month, tx('2026-01-10', -10)])).toBe(1);
  });

  it('sollte Umbuchungen nicht mitzählen', () => {
    expect(
      countCategorizedMonths([
        tx('2026-01-01', -10, { category_id: 'c1' }),
        tx('2026-01-02', -500, { is_transfer: true }),
      ]),
    ).toBe(1);
  });
});

describe('hasRecurringCandidate', () => {
  it('sollte ab drei Buchungen desselben Empfängers anschlagen', () => {
    // Dieselbe Schwelle wie contract-detection-service — darunter hätte das
    // Vertrags-Kapitel nichts zu zeigen.
    expect(
      hasRecurringCandidate([
        tx('2026-01-05', -12.99, { payee: 'Netflix' }),
        tx('2026-02-05', -12.99, { payee: 'Netflix' }),
        tx('2026-03-05', -12.99, { payee: 'Netflix' }),
      ]),
    ).toBe(true);
  });

  it('sollte bei zwei Buchungen noch nicht anschlagen', () => {
    expect(
      hasRecurringCandidate([
        tx('2026-01-05', -12.99, { payee: 'Netflix' }),
        tx('2026-02-05', -12.99, { payee: 'Netflix' }),
      ]),
    ).toBe(false);
  });

  it('sollte Einnahmen und Umbuchungen ignorieren', () => {
    expect(
      hasRecurringCandidate([
        tx('2026-01-01', 2500, { payee: 'Muster GmbH' }),
        tx('2026-02-01', 2500, { payee: 'Muster GmbH' }),
        tx('2026-03-01', 2500, { payee: 'Muster GmbH' }),
        tx('2026-01-02', -100, { payee: 'Sparkonto', is_transfer: true }),
        tx('2026-02-02', -100, { payee: 'Sparkonto', is_transfer: true }),
        tx('2026-03-02', -100, { payee: 'Sparkonto', is_transfer: true }),
      ]),
    ).toBe(false);
  });
});
