import { describe, it, expect } from 'vitest';
import { computeTaxReserve, resolveTaxReservePercent, DEFAULT_TAX_RESERVE_PERCENT } from '../tax-reserve';
import type { IncomeStream } from '../income-streams';

function stream(mainCategoryId: string | null, total: number, name = 'X'): IncomeStream {
  return {
    key: `${mainCategoryId}|${name}`, label: name, counterparty: name, mainCategoryId,
    mainCategoryName: name, isSalary: false, cadence: 'regelmaessig', monthlyAverage: total / 12,
    totalInWindow: total, lastDateISO: '2024-12-01', lastAmount: total / 12, monthsActive: 12,
    trend: 'flat', confidence: 0.9, share: 0, transactionCount: 12, nextDateISO: null,
    nextAmount: null, monthlyTotals: {},
  };
}

describe('resolveTaxReservePercent', () => {
  it('nutzt den Default bei undefined', () => {
    expect(resolveTaxReservePercent(undefined)).toBe(DEFAULT_TAX_RESERVE_PERCENT);
    expect(resolveTaxReservePercent(null)).toBe(DEFAULT_TAX_RESERVE_PERCENT);
    expect(resolveTaxReservePercent({})).toBe(DEFAULT_TAX_RESERVE_PERCENT);
  });

  it('lässt 0 als „aus" zu (überschreibt den Default)', () => {
    expect(resolveTaxReservePercent({ tax_reserve_percent: 0 })).toBe(0);
  });

  it('clampt auf 0..100', () => {
    expect(resolveTaxReservePercent({ tax_reserve_percent: 150 })).toBe(100);
    expect(resolveTaxReservePercent({ tax_reserve_percent: -5 })).toBe(0);
  });
});

describe('computeTaxReserve', () => {
  it('summiert nur steuerrelevante Mains und rechnet den Prozentsatz', () => {
    const result = computeTaxReserve(
      [
        stream('local-cat-onlinecreator', 5000, 'YouTube'),
        stream('local-cat-verkaeufe', 2000, 'eBay'),
        stream('local-cat-anstellung', 30000, 'Gehalt'),
      ],
      30,
    );
    expect(result).not.toBeNull();
    expect(result!.incomeTotal).toBe(7000);
    expect(result!.reserveTotal).toBe(2100);
    expect(result!.byMain).toHaveLength(2);
    expect(result!.byMain[0].mainCategoryId).toBe('local-cat-onlinecreator'); // größter zuerst
  });

  it('liefert null bei Prozentsatz 0', () => {
    expect(computeTaxReserve([stream('local-cat-onlinecreator', 5000)], 0)).toBeNull();
  });

  it('liefert null ohne relevantes Einkommen', () => {
    expect(computeTaxReserve([stream('local-cat-anstellung', 30000)], 30)).toBeNull();
  });

  it('[REGRESSION] sollte Anstellungs-Einkommen niemals in den Puffer einrechnen', () => {
    const result = computeTaxReserve(
      [stream('local-cat-nebenerwerb', 1000), stream('local-cat-anstellung', 50000)],
      30,
    );
    expect(result!.incomeTotal).toBe(1000);
    expect(result!.reserveTotal).toBe(300);
  });

  it('[Edge] dokumentiert: eine negative totalInWindow (z.B. Rückerstattung) senkt incomeTotal ungeklemmt und kann reserveTotal negativ machen', () => {
    // Kein Floor bei 0 auf incomeTotal/reserveTotal — eine Korrektur/Rückbuchung,
    // die größer als das übrige Einkommen im Fenster ist, kippt beide ins Negative.
    const result = computeTaxReserve(
      [stream('local-cat-verkaeufe', -500, 'Rückerstattung'), stream('local-cat-onlinecreator', 300, 'YouTube')],
      30,
    );
    expect(result!.incomeTotal).toBe(-200);
    expect(result!.reserveTotal).toBe(-60);
  });
});
