import { describe, it, expect } from 'vitest';
import { jahresRuecklage } from '../annual-reserve';
import type { ContractRow } from '@/lib/contract-types';

function zeile(over: Partial<ContractRow>): ContractRow {
  return {
    key: 'k',
    type: 'Ausgabe',
    payee: 'Versicherung',
    categoryName: 'Versicherungen',
    categoryId: 'c1',
    amountTypical: 120,
    amountLast: 120,
    cycle: 'Jährlich',
    lastDateISO: '2026-01-15',
    firstDateISO: '2024-01-15',
    nextDateISO: '2027-01-15',
    changed: false,
    changeAmount: 0,
    changeSinceLabel: null,
    confirmed: true,
    transactionIds: ['t1'],
    fingerprint: 'versicherung',
    status: 'active',
    stale: false,
    cycleKnown: true,
    ...over,
  } as ContractRow;
}

describe('Jahresrechnungs-Rücklage', () => {
  it('sollte eine Jahresrechnung auf zwölf Monate verteilen', () => {
    const r = jahresRuecklage([zeile({ amountTypical: 1200 })]);
    expect(r.monatlich).toBeCloseTo(100, 6);
    expect(r.proJahr).toBeCloseTo(1200, 6);
    expect(r.posten[0].proJahr).toBe(1);
  });

  it('sollte Vierteljährlich und Halbjährlich richtig gewichten', () => {
    const r = jahresRuecklage([
      zeile({ payee: 'Quartal', cycle: 'Vierteljährlich', amountTypical: 90 }),
      zeile({ payee: 'Halbjahr', cycle: 'Halbjährlich', amountTypical: 300 }),
    ]);
    // 90 × 4 / 12 = 30, 300 × 2 / 12 = 50
    expect(r.monatlich).toBeCloseTo(80, 6);
    // Absteigend nach Monatslast: Halbjahr (50) vor Quartal (30).
    expect(r.posten.map((p) => p.name)).toEqual(['Halbjahr', 'Quartal']);
  });

  it('sollte monatliche und wöchentliche Serien NICHT mitzählen', () => {
    // Sie sind laufende Kosten. Wer sie in die Rücklage zöge, legte dieselbe
    // Zahl zweimal zurück.
    const r = jahresRuecklage([
      zeile({ payee: 'Miete', cycle: 'Monatlich', amountTypical: 800 }),
      zeile({ payee: 'Zeitung', cycle: 'Wöchentlich', amountTypical: 5 }),
    ]);
    expect(r.monatlich).toBe(0);
    expect(r.posten).toEqual([]);
  });

  it('sollte Einnahmen und beendete Serien übergehen', () => {
    const r = jahresRuecklage([
      zeile({ payee: 'Bonus', type: 'Einnahme', amountTypical: 1200 }),
      zeile({ payee: 'Gekündigt', status: 'ended' } as Partial<ContractRow>),
      zeile({ payee: 'Veraltet', stale: true } as Partial<ContractRow>),
      zeile({ payee: 'Zyklus offen', cycleKnown: false } as Partial<ContractRow>),
    ]);
    expect(r.monatlich).toBe(0);
  });

  it('sollte den jüngeren Median bevorzugen, wenn es ihn gibt', () => {
    // Eine Beitragserhöhung soll sofort in der Rücklage stehen — sonst legt
    // man ein Jahr lang den alten Betrag zurück.
    const r = jahresRuecklage([zeile({ amountTypical: 1200, amountRecentTypical: 1800 })]);
    expect(r.monatlich).toBeCloseTo(150, 6);
  });

  it('sollte ohne Serien eine leere Rücklage liefern statt zu raten', () => {
    expect(jahresRuecklage([])).toEqual({ monatlich: 0, proJahr: 0, posten: [] });
  });
});
