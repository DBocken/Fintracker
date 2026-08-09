import { describe, it, expect } from 'vitest';
import { buildWeekdayPattern } from '../weekday-pattern';
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';

/**
 * Lag bis WP 6.6 in `src/lib/__tests__/analysis-data.test.ts` — mit dem Modul
 * mitgewandert (ARCH-6). Die Zusicherungen sind unverändert.
 */
describe('buildWeekdayPattern (Wochenmuster-Aufbereitung)', () => {
  function tx(partial: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
    return {
      date: '2026-01-05',
      amount: -10,
      payee: 'Test',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: true,
      ...partial,
    id: partial.id !== undefined ? asTransactionId(partial.id) : undefined,
    };
  }

  describe('buildWeekdayPattern (Issue #40)', () => {
    it('liefert immer 7 Wochentage in Mo–So-Reihenfolge', () => {
      const result = buildWeekdayPattern([]);
      expect(result.map((e) => e.day)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    });

    it('bucketiert Einnahmen und Ausgaben auf den richtigen Wochentag', () => {
      // 2026-01-05 ist ein Montag, 2026-01-10 ein Samstag.
      const result = buildWeekdayPattern([
        tx({ date: '2026-01-05', amount: 1000 }),
        tx({ date: '2026-01-05', amount: -200 }),
        tx({ date: '2026-01-10', amount: -50 }),
      ]);
      expect(result[0]).toEqual({ day: 'Mo', income: 1000, expenses: 200 });
      expect(result[5]).toEqual({ day: 'Sa', income: 0, expenses: 50 });
    });

    it('ignoriert Transaktionen mit unparsebarem Datum', () => {
      const result = buildWeekdayPattern([tx({ date: 'kein-datum', amount: -99 })]);
      expect(result.every((e) => e.income === 0 && e.expenses === 0)).toBe(true);
    });

    it('zählt interne Überträge weder als Einnahme noch als Ausgabe (Invariante 2)', () => {
      // Eine Umbuchung aufs Tagesgeld ist kein Ausgabetag. Zählt sie mit,
      // erscheint der Sparrate-Tag als teuerster Wochentag und die
      // Wochenmuster-Aussage („Samstag ist dein teuerster Tag") ist falsch.
      const mitUebertrag = buildWeekdayPattern([
        tx({ date: '2026-01-05', amount: -200 }),
        tx({ date: '2026-01-05', amount: -800, is_transfer: true }),
        tx({ date: '2026-01-05', amount: 800, is_transfer: true }),
      ]);
      expect(mitUebertrag[0]).toEqual({ day: 'Mo', income: 0, expenses: 200 });
    });
  });
});
