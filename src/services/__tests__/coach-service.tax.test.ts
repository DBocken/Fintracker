import { describe, it, expect } from 'vitest';
import { buildTaxReserveRecommendation } from '../coach-service';
import type { IncomeStream } from '@/lib/income-streams';

function stream(mainCategoryId: string | null, total: number): IncomeStream {
  return {
    key: `${mainCategoryId}|x`, label: 'X', counterparty: 'x', mainCategoryId, mainCategoryName: 'Online & Creator',
    isSalary: false, cadence: 'regelmaessig', monthlyAverage: total / 12, totalInWindow: total, lastDateISO: '2024-12-01',
    lastAmount: total / 12, monthsActive: 12, trend: 'flat', confidence: 0.9, share: 0.5, transactionCount: 12,
    nextDateISO: null, nextAmount: null, monthlyTotals: {},
    payments: [],
  };
}

describe('buildTaxReserveRecommendation', () => {
  it('baut eine Empfehlung mit ctaTo /income bei relevantem Einkommen', () => {
    const rec = buildTaxReserveRecommendation([stream('local-cat-onlinecreator', 5000)], 30);
    expect(rec).not.toBeNull();
    expect(rec!.id).toBe('tax-reserve');
    expect(rec!.severity).toBe('info');
    expect(rec!.ctaTo).toBe('/income');
    expect(rec!.message).toContain('30');
  });

  it('liefert null ohne relevantes Einkommen', () => {
    expect(buildTaxReserveRecommendation([stream('local-cat-anstellung', 30000)], 30)).toBeNull();
  });

  it('liefert null bei 0 %', () => {
    expect(buildTaxReserveRecommendation([stream('local-cat-onlinecreator', 5000)], 0)).toBeNull();
  });
});
