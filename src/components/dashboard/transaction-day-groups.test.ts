import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/types';
import { buildDayGroups, formatDayHeading } from './transaction-day-groups';

function tx(p: Partial<Transaction> & { date: string; amount: number }): Transaction {
  return {
    id: `${p.date}-${p.amount}-${Math.abs(p.amount)}`,
    payee: p.payee ?? 'Test',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...p,
  };
}

describe('buildDayGroups', () => {
  describe('Normal Behavior', () => {
    it('sollte Buchungen nach Tag gruppieren und die Reihenfolge (neuester Tag zuerst) halten', () => {
      const groups = buildDayGroups(
        [
          tx({ date: '2026-07-03', amount: -23.4, payee: 'Lieferando' }),
          tx({ date: '2026-07-02', amount: -41.17, payee: 'Rewe' }),
          tx({ date: '2026-07-02', amount: -4.8, payee: 'Bäckerei' }),
        ],
        1240,
      );

      expect(groups.map((g) => g.key)).toEqual(['2026-07-03', '2026-07-02']);
      expect(groups[1].items).toHaveLength(2);
    });

    it('sollte den Tagessaldo als Summe aller Beträge des Tages berechnen', () => {
      const groups = buildDayGroups(
        [
          tx({ date: '2026-06-30', amount: 2180, payee: 'Gehalt' }),
          tx({ date: '2026-06-30', amount: -32.67, payee: 'Wochenmarkt' }),
        ],
        137.68,
      );

      expect(groups[0].delta).toBe(2147.33);
    });

    it('[REGRESSION] sollte den Kontostand am Tagesende rückwärts aus dem aktuellen Saldo ableiten', () => {
      // Werte aus dem Buchungs-Schema (Screenshot): der jüngste Tag endet auf dem
      // aktuellen Gesamtsaldo, ältere Tage werden rückwärts berechnet.
      const groups = buildDayGroups(
        [
          tx({ date: '2026-07-03', amount: -23.4 }),
          tx({ date: '2026-07-02', amount: -41.17 }),
          tx({ date: '2026-07-02', amount: -4.8 }),
          tx({ date: '2026-07-02', amount: -7.19 }),
          tx({ date: '2026-07-01', amount: -49 }),
          tx({ date: '2026-07-01', amount: -890 }),
          tx({ date: '2026-07-01', amount: -29.45 }),
          tx({ date: '2026-06-30', amount: 2180 }),
          tx({ date: '2026-06-30', amount: -32.67 }),
        ],
        1240,
      );

      const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
      expect(byKey['2026-07-03'].runningBalance).toBe(1240);
      expect(byKey['2026-07-02'].runningBalance).toBe(1263.4);
      expect(byKey['2026-07-01'].runningBalance).toBe(1316.56);
      expect(byKey['2026-06-30'].runningBalance).toBe(2285.01);
      // Delta des Gehaltstages ist positiv.
      expect(byKey['2026-06-30'].delta).toBe(2147.33);
    });

    it('sollte Float-Drift vermeiden (cent-genaue Summen)', () => {
      const groups = buildDayGroups(
        [
          tx({ date: '2026-07-01', amount: 0.1 }),
          tx({ date: '2026-07-01', amount: 0.2 }),
        ],
        10,
      );
      expect(groups[0].delta).toBe(0.3);
    });
  });

  describe('Edge Cases', () => {
    it('sollte mit leerer Liste eine leere Gruppierung liefern', () => {
      expect(buildDayGroups([], 100)).toEqual([]);
    });

    it('sollte bei nur einem Tag den Endsaldo genau auf endingBalance setzen', () => {
      const groups = buildDayGroups([tx({ date: '2026-07-01', amount: -50 })], 950);
      expect(groups).toHaveLength(1);
      expect(groups[0].runningBalance).toBe(950);
      expect(groups[0].delta).toBe(-50);
    });

    it('sollte unsortierte Eingaben trotzdem absteigend nach Tag ordnen', () => {
      const groups = buildDayGroups(
        [
          tx({ date: '2026-06-30', amount: 100 }),
          tx({ date: '2026-07-02', amount: -10 }),
          tx({ date: '2026-07-01', amount: -20 }),
        ],
        500,
      );
      expect(groups.map((g) => g.key)).toEqual(['2026-07-02', '2026-07-01', '2026-06-30']);
      expect(groups[0].runningBalance).toBe(500);
      expect(groups[1].runningBalance).toBe(510);
      expect(groups[2].runningBalance).toBe(530);
    });
  });
});

describe('formatDayHeading', () => {
  const now = new Date('2026-07-03T12:00:00');

  it('sollte den heutigen Tag mit „Heute" kennzeichnen', () => {
    expect(formatDayHeading('2026-07-03', now)).toMatch(/^Heute · /);
  });

  it('sollte den Vortag mit „Gestern" kennzeichnen', () => {
    expect(formatDayHeading('2026-07-02', now)).toMatch(/^Gestern · /);
  });

  it('sollte ältere Tage nur mit Wochentag und Datum zeigen', () => {
    const label = formatDayHeading('2026-07-01', now);
    expect(label).not.toMatch(/Heute|Gestern/);
    expect(label).toContain('1.7.');
  });

  it('sollte einen ungültigen Datums-Key unverändert zurückgeben', () => {
    expect(formatDayHeading('nicht-ein-datum', now)).toBe('nicht-ein-datum');
  });
});
