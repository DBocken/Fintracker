import { describe, it, expect } from 'vitest';
import { buildTaxYearReport, hasEuerMarkings } from '../tax-report';
import type { Transaction } from '@/types';
import type { TaxYearProfile } from '@/lib/tax-types';

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

  describe('EÜR-Entkopplung (Einzelunternehmer)', () => {
    it('[REGRESSION] sollte EÜR-markierte Buchungen NICHT zählen (eigene /euer-Auswertung, keine Doppelzählung)', () => {
      const txs = [
        tx({ amount: -500, tax_category_id: 'tax-eur-betriebsausgabe' }),
        tx({ amount: -200, tax_category_id: 'tax-eur-bewirtung' }),
        tx({ amount: 3000, tax_category_id: 'tax-eur-betriebseinnahme' }),
      ];
      const report = buildTaxYearReport(txs, 2025, null);
      expect(rubric(report, 'betriebsausgaben')).toBeUndefined();
      expect(rubric(report, 'betriebseinnahmen')).toBeUndefined();
      expect(report.markedTotal).toBe(0);
      expect(report.txCount).toBe(0);
    });

    it('sollte Nicht-EÜR-Markierungen daneben unverändert auswerten', () => {
      const txs = [
        tx({ amount: -500, tax_category_id: 'tax-eur-betriebsausgabe' }),
        tx({ amount: -100, tax_category_id: 'tax-agb-krankheit' }),
      ];
      const report = buildTaxYearReport(txs, 2025, null);
      expect(rubric(report, 'agb')?.costsTotal).toBe(100);
      expect(report.txCount).toBe(1);
    });

    it('hasEuerMarkings sollte EÜR-Markierungen erkennen (für die Pointer-Karte)', () => {
      expect(hasEuerMarkings([tx({ tax_category_id: 'tax-eur-bewirtung' })])).toBe(true);
      expect(hasEuerMarkings([tx({ tax_category_id: 'tax-agb-krankheit' })])).toBe(false);
      expect(hasEuerMarkings([tx({})])).toBe(false);
      expect(hasEuerMarkings([])).toBe(false);
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

  describe('Musterrechnungen (End-to-End, amtliche Beispiele)', () => {
    it('Handwerker VZ 2025: 1.800 € Rechnung / 1.200 € Arbeitskosten → min(1.200; 6.000) × 20 % = 240 €', () => {
      const txs = [tx({ amount: -1800, tax_category_id: 'tax-35a3-handwerker', tax_labor_costs: 1200 })];
      const report = buildTaxYearReport(txs, 2025, null);
      const hw = rubric(report, '35a-handwerker')!;
      // Rechenweg: Bemessungsgrundlage 1.200 € (nur Arbeitskosten) → keine
      // Kappung (< 6.000 €) → 1.200 × 0,2 = 240 € → kein Deckel (< 1.200 €).
      expect(hw.calculation).toEqual({
        base: 1200,
        capCosts: 6000,
        cappedBase: 1200,
        rate: 0.2,
        rawCredit: 240,
        capCredit: 1200,
        credit: 240,
      });
    });

    it('Dienstleistungen VZ 2025: 21.000 € → gedeckelt 20.000 € × 20 % = 4.000 € (Höchstbetrag erreicht)', () => {
      const txs = [tx({ amount: -21000, tax_category_id: 'tax-35a2-dienstleistung' })];
      const report = buildTaxYearReport(txs, 2025, null);
      const dl = rubric(report, '35a-dienstleistungen')!;
      // Rechenweg: 21.000 € > Kosten-Deckel 20.000 € → 20.000 × 0,2 = 4.000 € =
      // exakt der Ermäßigungs-Höchstbetrag.
      expect(dl.calculation).toEqual({
        base: 21000,
        capCosts: 20000,
        cappedBase: 20000,
        rate: 0.2,
        rawCredit: 4000,
        capCredit: 4000,
        credit: 4000,
      });
      expect(dl.capUtilization).toBe(1);
    });

    it('[REGRESSION] Pendler 220 Tage × 30 km via Profil: 2.156 € (VZ 2025) vs. 2.508 € (VZ 2026)', () => {
      const profile: TaxYearProfile = {
        id: 'p',
        year: 2025,
        commuteDaysPerYear: 220,
        commuteOneWayKm: 30,
        homeofficeDays: 0,
      };
      const txs25 = [tx({ date: '2025-06-01', amount: -10, tax_category_id: 'tax-n-arbeitsmittel' })];
      // VZ 2025: 220 × (20 × 0,30 + 10 × 0,38) = 220 × 9,80 = 2.156 €
      const r25 = rubric(buildTaxYearReport(txs25, 2025, profile), 'werbungskosten')!;
      expect(r25.virtualItems.find((v) => v.labelKey === 'tax.commute.pendlerResult')?.amount).toBe(2156);

      const txs26 = [tx({ date: '2026-06-01', amount: -10, tax_category_id: 'tax-n-arbeitsmittel' })];
      // VZ 2026 (StÄndG 2025): 220 × 30 × 0,38 = 2.508 €
      const r26 = rubric(buildTaxYearReport(txs26, 2026, { ...profile, year: 2026 }), 'werbungskosten')!;
      expect(r26.virtualItems.find((v) => v.labelKey === 'tax.commute.pendlerResult')?.amount).toBe(2508);
    });

    it('Homeoffice 250 Tage → gedeckelt 210 × 6 € = 1.260 € (VZ 2025)', () => {
      const profile: TaxYearProfile = {
        id: 'p',
        year: 2025,
        commuteDaysPerYear: 0,
        commuteOneWayKm: 0,
        homeofficeDays: 250,
      };
      const txs = [tx({ amount: -10, tax_category_id: 'tax-n-arbeitsmittel' })];
      const wk = rubric(buildTaxYearReport(txs, 2025, profile), 'werbungskosten')!;
      expect(wk.virtualItems.find((v) => v.labelKey === 'tax.commute.homeofficeResult')?.amount).toBe(1260);
    });

    it('deduction-Rubriken haben keinen Rechenweg (calculation = null)', () => {
      const txs = [tx({ amount: -100, tax_category_id: 'tax-agb-krankheit' })];
      const report = buildTaxYearReport(txs, 2025, null);
      expect(rubric(report, 'agb')!.calculation).toBeNull();
      expect(rubric(report, 'werbungskosten')!.calculation).toBeNull();
    });
  });

  describe('§35c (nur informativ)', () => {
    it('sollte Kosten sammeln, aber KEINE Gutschrift und keinen Cap-Balken berechnen', () => {
      const txs = [tx({ amount: -20000, tax_category_id: 'tax-35c-sanierung' })];
      const report = buildTaxYearReport(txs, 2025, null);
      const s = rubric(report, '35c-sanierung')!;
      expect(s.costsTotal).toBe(20000);
      expect(s.credit).toBeNull();
      expect(s.capUtilization).toBeNull();
      expect(report.creditTotal).toBe(0);
    });
  });

  describe('Robustheit', () => {
    it('sollte Buchungen mit unbekannter Steuer-Kategorie ignorieren', () => {
      const txs = [
        tx({ amount: -100, tax_category_id: 'tax-gibt-es-nicht' }),
        tx({ amount: -50, tax_category_id: 'tax-agb-krankheit' }),
      ];
      const report = buildTaxYearReport(txs, 2025, null);
      expect(report.markedTotal).toBe(50);
      expect(rubric(report, 'agb')!.costsTotal).toBe(50);
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
