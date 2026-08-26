import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Transaction } from '@/types';
import { sumIncome, sumExpenses } from '../analysis-data';
import { toMinor, toMajor, sumMinor, parseGermanNumber } from '../money';

/**
 * Eigenschaften der Geld- und Aggregationskerne.
 *
 * Gegenstück zu `features/shared/domain/__tests__/balance-calculations.properties.test.ts`:
 * Die dort genannten Invarianten aus `docs/domain-invariants.md` werden hier
 * für die Bausteine geprüft, aus denen jede Auswertung zusammengesetzt ist.
 */

const amountArb = fc.integer({ min: -500_000, max: 500_000 }).map((c) => c / 100);
const cents = (value: number) => Math.round(value * 100);

const txArb = fc
  .record({ amount: amountArb, is_transfer: fc.boolean() })
  .map(
    ({ amount, is_transfer }): Transaction => ({
      account_id: 'acc-1',
      date: '2026-08-01',
      amount,
      is_transfer,
      payee: '',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: true,
    }),
  );

describe('Geld-Eigenschaften', () => {
  it('toMajor(toMinor(x)) gibt jeden 2-Dezimal-Betrag verlustfrei zurück', () => {
    fc.assert(
      fc.property(amountArb, (euro) => {
        expect(toMajor(toMinor(euro))).toBe(euro);
      }),
      { numRuns: 500 },
    );
  });

  it('sumMinor ist reihenfolge- und gruppierungsunabhängig (Integer-Cent, kein Float-Drift)', () => {
    fc.assert(
      fc.property(fc.array(amountArb, { maxLength: 60 }), (euros) => {
        const minor = euros.map(toMinor);
        const gedreht = [...minor].reverse();
        expect(sumMinor(gedreht)).toBe(sumMinor(minor));

        const mitte = Math.floor(minor.length / 2);
        const geteilt = sumMinor([
          sumMinor(minor.slice(0, mitte)),
          sumMinor(minor.slice(mitte)),
        ]);
        expect(geteilt).toBe(sumMinor(minor));
      }),
      { numRuns: 300 },
    );
  });

  it('parseGermanNumber liest jeden deutsch formatierten Betrag zurück, den es erzeugt', () => {
    fc.assert(
      fc.property(fc.integer({ min: -99_999_999, max: 99_999_999 }), (c) => {
        const euro = c / 100;
        const deutsch = euro.toLocaleString('de-DE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        expect(cents(parseGermanNumber(deutsch) as number)).toBe(c);
      }),
      { numRuns: 500 },
    );
  });
});

describe('Aggregations-Eigenschaften', () => {
  it('[REGRESSION] Invariante 2: ein Transferpaar verändert weder Einnahmen noch Ausgaben', () => {
    fc.assert(
      fc.property(fc.array(txArb, { maxLength: 40 }), amountArb, (txs, betrag) => {
        const hin: Transaction = { ...txs[0], amount: betrag, is_transfer: true };
        const her: Transaction = { ...txs[0], amount: -betrag, is_transfer: true };
        expect(cents(sumIncome([...txs, hin, her]))).toBe(cents(sumIncome(txs)));
        expect(cents(sumExpenses([...txs, hin, her]))).toBe(cents(sumExpenses(txs)));
      }),
      { numRuns: 300 },
    );
  });

  it('Einnahmen minus Ausgaben ist die transferbereinigte Summe aller Beträge', () => {
    fc.assert(
      fc.property(fc.array(txArb, { maxLength: 50 }), (txs) => {
        const erwartet = sumMinor(
          txs.filter((t) => !t.is_transfer).map((t) => toMinor(t.amount)),
        );
        expect(cents(sumIncome(txs) - sumExpenses(txs))).toBe(erwartet as number);
      }),
      { numRuns: 300 },
    );
  });

  it('Einnahmen und Ausgaben sind nie negativ', () => {
    fc.assert(
      fc.property(fc.array(txArb, { maxLength: 50 }), (txs) => {
        expect(sumIncome(txs)).toBeGreaterThanOrEqual(0);
        expect(sumExpenses(txs)).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });
});
