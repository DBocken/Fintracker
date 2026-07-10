import { describe, it, expect } from 'vitest';
import { buildTaxYearReport } from '../tax-report';
import type { Transaction } from '@/types';
import type { TaxYearProfile } from '@/services/tax-profile-service';

let seq = 0;
function tx(overrides: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    id: overrides.id || `tx-${seq}`,
    date: '2025-05-10',
    amount: -100,
    payee: 'X',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
  };
}

function rubric(report: ReturnType<typeof buildTaxYearReport>, id: string) {
  return report.rubrics.find((r) => r.rubricId === id);
}

describe('buildTaxYearReport', () => {
  describe('§35a Handwerker (credit, laborCostOnly)', () => {
    it('sollte 20 % nur der Arbeitskosten als exakte Ermäßigung berechnen', () => {
      const txs = [tx({ amount: -1800, tax_category_id: 'tax-35a3-handwerker', tax_labor_costs: 1200 })];
      const report = buildTaxYearReport(txs, 2025, null);
      const hw = rubric(report, '35a-handwerker')!;
      expect(hw.credit).toBe(240); // 20 % von 1.200 €
      expect(hw.eligibleCosts).toBe(1200);
      expect(report.creditTotal).toBe(240);
    });

    it('[REGRESSION] sollte ohne Arbeitskostenanteil 0 € ansetzen und warnen (nie 100 %)', () => {
      const txs = [tx({ amount: -1800, tax_category_id: 'tax-35a3-handwerker' })];
      const report = buildTaxYearReport(txs, 2025, null);
      const hw = rubric(report, '35a-handwerker')!;
      expect(hw.credit).toBe(0);
      expect(hw.warnings.some((w) => w.kind === 'missingLaborCosts' && w.count === 1)).toBe(true);
    });

    it('sollte den Ermäßigungs-Höchstbetrag (1.200 €) deckeln', () => {
      const txs = [tx({ amount: -10000, tax_category_id: 'tax-35a3-handwerker', tax_labor_costs: 8000 })];
      const report = buildTaxYearReport(txs, 2025, null);
      const hw = rubric(report, '35a-handwerker')!;
      expect(hw.credit).toBe(1200);
      expect(hw.capUtilization).toBe(1);
      expect(hw.warnings.some((w) => w.kind === 'capCostsExceeded')).toBe(true);
    });
  });

  describe('Erstattungen (Netting)', () => {
    it('sollte positive markierte Beträge als Erstattung abziehen', () => {
      const txs = [
        tx({ amount: -500, tax_category_id: 'tax-agb-krankheit' }),
        tx({ amount: 200, tax_category_id: 'tax-agb-krankheit' }),
      ];
      const report = buildTaxYearReport(txs, 2025, null);
      const agb = rubric(report, 'agb')!;
      expect(agb.costsTotal).toBe(300); // 500 - 200
    });

    it('[REGRESSION] sollte bei Erstattung > Kosten auf 0 clampen und warnen', () => {
      const txs = [
        tx({ amount: -100, tax_category_id: 'tax-agb-krankheit' }),
        tx({ amount: 300, tax_category_id: 'tax-agb-krankheit' }),
      ];
      const report = buildTaxYearReport(txs, 2025, null);
      const agb = rubric(report, 'agb')!;
      expect(agb.costsTotal).toBe(0);
      expect(agb.warnings.some((w) => w.kind === 'negativeNet')).toBe(true);
    });
  });

  describe('Jahresgrenze (Abflussprinzip)', () => {
    it('[REGRESSION] sollte 31.12. einschließen und 01.01. des Folgejahres ausschließen', () => {
      const txs = [
        tx({ date: '2025-12-31', amount: -100, tax_category_id: 'tax-agb-krankheit' }),
        tx({ date: '2026-01-01', amount: -999, tax_category_id: 'tax-agb-krankheit' }),
      ];
      const report = buildTaxYearReport(txs, 2025, null);
      const agb = rubric(report, 'agb')!;
      expect(agb.costsTotal).toBe(100);
    });
  });

  describe('Transfers', () => {
    it('[REGRESSION] sollte markierte interne Überträge ignorieren', () => {
      const txs = [
        tx({ amount: -100, tax_category_id: 'tax-agb-krankheit', is_transfer: true }),
      ];
      const report = buildTaxYearReport(txs, 2025, null);
      const agb = rubric(report, 'agb');
      // agb wird nur angezeigt, wenn Daten vorhanden — hier keine.
      expect(agb).toBeUndefined();
      expect(report.markedTotal).toBe(0);
    });
  });

  describe('Werbungskosten-Schwelle (Anlage N)', () => {
    it('sollte den Rest bis zum Pauschbetrag (1.230 €) anzeigen', () => {
      const txs = [tx({ amount: -200, tax_category_id: 'tax-n-arbeitsmittel' })];
      const report = buildTaxYearReport(txs, 2025, null);
      const wk = rubric(report, 'werbungskosten')!;
      expect(wk.threshold?.value).toBe(1230);
      expect(wk.threshold?.reached).toBe(false);
      expect(wk.threshold?.remaining).toBe(1030);
    });

    it('sollte die Pendlerpauschale aus dem Profil über die Schwelle heben', () => {
      const profile: TaxYearProfile = {
        id: 'tax-profile-2025',
        year: 2025,
        commuteDaysPerYear: 220,
        commuteOneWayKm: 30,
        homeofficeDays: 0,
      };
      const txs = [tx({ amount: -100, tax_category_id: 'tax-n-arbeitsmittel' })];
      const report = buildTaxYearReport(txs, 2025, profile);
      const wk = rubric(report, 'werbungskosten')!;
      // 2025: 220 * (20*0,30 + 10*0,38) = 2156 → plus 100 € > 1230
      expect(wk.virtualItems.some((v) => v.labelKey === 'tax.commute.pendlerResult' && v.amount === 2156)).toBe(true);
      expect(wk.threshold?.reached).toBe(true);
    });
  });

  describe('Parameter-Clamping', () => {
    it('sollte für unbekannte Jahre paramsExact=false liefern und warnen', () => {
      const txs = [tx({ date: '2030-05-10', amount: -100, tax_category_id: 'tax-agb-krankheit' })];
      const report = buildTaxYearReport(txs, 2030, null);
      expect(report.paramsExact).toBe(false);
      expect(report.paramsUsedYear).toBe(2026);
      const agb = rubric(report, 'agb')!;
      expect(agb.warnings.some((w) => w.kind === 'paramsNotExact')).toBe(true);
    });
  });

  describe('Performance', () => {
    it('sollte 5.000 Buchungen in einem Durchlauf verarbeiten', () => {
      const txs = Array.from({ length: 5000 }, (_, i) =>
        tx({ id: `p-${i}`, amount: -10, tax_category_id: 'tax-agb-krankheit' }),
      );
      const report = buildTaxYearReport(txs, 2025, null);
      const agb = rubric(report, 'agb')!;
      expect(agb.costsTotal).toBe(50000);
      expect(report.txCount).toBe(5000);
    });
  });
});
