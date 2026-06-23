import { describe, it, expect } from 'vitest';
import { buildLumpyRiskProfile } from '../lumpy-risk';
import type { Transaction } from '@/types';

function tx(date: string, amount: number, extra: Partial<Transaction> = {}): Transaction {
  return {
    date,
    amount,
    payee: 'Test',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...extra,
  };
}

/** Viele kleine Alltagsausgaben (~20 €) über ein Jahr, gleichmäßig verteilt. */
function smallEverydaySpends(count: number): Transaction[] {
  const out: Transaction[] = [];
  for (let i = 0; i < count; i++) {
    const day = String((i % 27) + 1).padStart(2, '0');
    const month = String((i % 12) + 1).padStart(2, '0');
    out.push(tx(`2025-${month}-${day}`, -20, { category: 'Lebensmittel' }));
  }
  return out;
}

describe('buildLumpyRiskProfile', () => {
  describe('Normal Behavior', () => {
    it('sollte die Jahresrate der Lumpy-Events korrekt hochrechnen', () => {
      const bigs = [
        tx('2025-01-15', -1000, { category: 'Reparatur' }),
        tx('2025-03-15', -1200, { category: 'Reise' }),
        tx('2025-05-15', -900, { category: 'Elektronik' }),
        tx('2025-07-15', -1500, { category: 'Zahnarzt' }),
        tx('2025-09-15', -1100, { category: 'Reparatur' }),
        tx('2025-12-15', -1300, { category: 'Reise' }),
      ];
      // Spannweite über fast ein Jahr -> Rate ~ Anzahl Events.
      const profile = buildLumpyRiskProfile([...smallEverydaySpends(60), ...bigs]);
      expect(profile.lumpyCount).toBe(6);
      expect(profile.lumpyRateAnnual).toBeGreaterThan(5);
      expect(profile.lumpyRateAnnual).toBeLessThan(8);
    });

    it('sollte monotone Severity-Quantile liefern (P50 <= P75 <= P90)', () => {
      const bigs = [200, 400, 600, 800, 1000, 2000].map((a, i) =>
        tx(`2025-0${(i % 9) + 1}-10`, -a, { category: 'Sonderausgabe' }),
      );
      const profile = buildLumpyRiskProfile([...smallEverydaySpends(40), ...bigs]);
      expect(profile.lumpySeverityP50).toBeLessThanOrEqual(profile.lumpySeverityP75);
      expect(profile.lumpySeverityP75).toBeLessThanOrEqual(profile.lumpySeverityP90);
    });

    it('sollte die stärksten Kategorien nach Summe ausweisen', () => {
      const bigs = [
        tx('2025-01-10', -2000, { category: 'Reise' }),
        tx('2025-02-10', -1500, { category: 'Reparatur' }),
        tx('2025-03-10', -1000, { category: 'Reise' }),
      ];
      const profile = buildLumpyRiskProfile([...smallEverydaySpends(40), ...bigs]);
      expect(profile.topCategories[0].category).toBe('Reise');
      expect(profile.topCategories[0].total).toBeCloseTo(3000, 2);
    });
  });

  describe('Edge Cases', () => {
    it('sollte bei reiner Alltagshistorie ein niedriges Risikolevel liefern', () => {
      const profile = buildLumpyRiskProfile(smallEverydaySpends(80));
      expect(profile.lumpyCount).toBe(0);
      expect(profile.lumpyRiskLevel).toBe('low');
    });

    it('sollte Transfers und Verträge ausschließen', () => {
      const data = [
        ...smallEverydaySpends(40),
        tx('2025-04-10', -5000, { category: 'Übertrag', is_transfer: true }),
        tx('2025-05-10', -3000, { category: 'Versicherung', is_contract: true }),
      ];
      const profile = buildLumpyRiskProfile(data);
      expect(profile.lumpyCount).toBe(0);
    });

    it('sollte mit leerer Historie robust sein', () => {
      const profile = buildLumpyRiskProfile([]);
      expect(profile.lumpyCount).toBe(0);
      expect(profile.lumpyRiskLevel).toBe('low');
    });
  });
});
