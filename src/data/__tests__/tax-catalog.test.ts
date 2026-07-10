import { describe, it, expect } from 'vitest';
import {
  TAX_RUBRICS,
  TAX_CATEGORIES,
  TAX_YEAR_PARAMS,
  getTaxParams,
  compute35aCredit,
  computePendlerpauschale,
  computeHomeofficePauschale,
  getRubricForCategory,
  taxCategoryById,
} from '../tax-catalog';

describe('Tax Catalog', () => {
  describe('Struktur-Integrität', () => {
    it('sollte eindeutige Rubrik-IDs haben', () => {
      const ids = TAX_RUBRICS.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('sollte eindeutige Kategorie-IDs haben', () => {
      const ids = TAX_CATEGORIES.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('sollte jede Kategorie einer existierenden Rubrik zuordnen', () => {
      const rubricIds = new Set(TAX_RUBRICS.map((r) => r.id));
      for (const cat of TAX_CATEGORIES) {
        expect(rubricIds.has(cat.rubricId)).toBe(true);
      }
    });

    it('sollte nur lowercase-Keywords enthalten (Vergleich erfolgt lowercased)', () => {
      for (const cat of TAX_CATEGORIES) {
        for (const kw of cat.keywords) {
          expect(kw).toBe(kw.toLowerCase());
        }
      }
    });

    it('sollte für jede credit-Rubrik Satz- und Cap-Parameter definieren', () => {
      for (const r of TAX_RUBRICS.filter((r) => r.kind === 'credit' && !r.informationalOnly)) {
        expect(r.creditRateParam).toBeDefined();
        expect(r.capCreditParam).toBeDefined();
      }
    });

    it('getRubricForCategory sollte die Rubrik über die Kategorie auflösen', () => {
      expect(getRubricForCategory('tax-35a3-handwerker')?.id).toBe('35a-handwerker');
      expect(getRubricForCategory('nicht-existent')).toBeUndefined();
    });

    it('taxCategoryById sollte alle Kategorien indizieren', () => {
      expect(taxCategoryById.size).toBe(TAX_CATEGORIES.length);
      expect(taxCategoryById.get('tax-so-spenden')?.rubricId).toBe('sonderausgaben');
    });
  });

  describe('getTaxParams', () => {
    it('sollte exakte Parameter für bekannte Jahre liefern', () => {
      expect(getTaxParams(2024)).toEqual({ params: TAX_YEAR_PARAMS[2024], exact: true });
      expect(getTaxParams(2025).exact).toBe(true);
      expect(getTaxParams(2026).exact).toBe(true);
    });

    it('sollte Kinderbetreuung 2024 (2/3, 4.000) vs. 2025 (80 %, 4.800) unterscheiden', () => {
      expect(TAX_YEAR_PARAMS[2024].kinderbetreuungRate).toBeCloseTo(2 / 3, 5);
      expect(TAX_YEAR_PARAMS[2024].kinderbetreuungMaxProKind).toBe(4000);
      expect(TAX_YEAR_PARAMS[2025].kinderbetreuungRate).toBe(0.8);
      expect(TAX_YEAR_PARAMS[2025].kinderbetreuungMaxProKind).toBe(4800);
    });

    it('[REGRESSION] sollte Pendlerpauschale 2025 (0,30/0,38) vs. 2026 (0,38/0,38) korrekt halten', () => {
      expect(TAX_YEAR_PARAMS[2025].pendlerKm1bis20).toBe(0.3);
      expect(TAX_YEAR_PARAMS[2025].pendlerAbKm21).toBe(0.38);
      expect(TAX_YEAR_PARAMS[2026].pendlerKm1bis20).toBe(0.38);
      expect(TAX_YEAR_PARAMS[2026].pendlerAbKm21).toBe(0.38);
    });

    it('sollte Arbeitnehmer-Pauschbetrag 1.230 € über alle VZ halten', () => {
      expect(TAX_YEAR_PARAMS[2024].arbeitnehmerPauschbetrag).toBe(1230);
      expect(TAX_YEAR_PARAMS[2025].arbeitnehmerPauschbetrag).toBe(1230);
      expect(TAX_YEAR_PARAMS[2026].arbeitnehmerPauschbetrag).toBe(1230);
    });

    it('sollte für unbekannte Jahre klemmen und exact=false setzen', () => {
      const before = getTaxParams(2020);
      expect(before.exact).toBe(false);
      expect(before.params.vz).toBe(2024);
      const after = getTaxParams(2030);
      expect(after.exact).toBe(false);
      expect(after.params.vz).toBe(2026);
    });
  });

  describe('compute35aCredit', () => {
    it('sollte 20 % auf die Kosten geben (Happy Path)', () => {
      const r = compute35aCredit(1000, 0.2, 6000, 1200);
      expect(r.credit).toBe(200);
      expect(r.cappedCosts).toBe(1000);
      expect(r.capCostsExceeded).toBe(false);
    });

    it('sollte den Ermäßigungs-Höchstbetrag genau erreichen (Handwerker 6.000 → 1.200)', () => {
      const r = compute35aCredit(6000, 0.2, 6000, 1200);
      expect(r.credit).toBe(1200);
      expect(r.capUtilization).toBe(1);
      expect(r.capCostsExceeded).toBe(false);
    });

    it('sollte über dem Kosten-Höchstbetrag deckeln und den Cap melden', () => {
      const r = compute35aCredit(9000, 0.2, 6000, 1200);
      expect(r.credit).toBe(1200);
      expect(r.cappedCosts).toBe(6000);
      expect(r.capCostsExceeded).toBe(true);
    });

    it('sollte 0/negativ/NaN als 0 behandeln', () => {
      expect(compute35aCredit(0, 0.2, 6000, 1200).credit).toBe(0);
      expect(compute35aCredit(-500, 0.2, 6000, 1200).credit).toBe(0);
      expect(compute35aCredit(Number.NaN, 0.2, 6000, 1200).credit).toBe(0);
    });
  });

  describe('computePendlerpauschale', () => {
    it('[REGRESSION] sollte 2026 ab dem 1. km 0,38 € rechnen', () => {
      const r = computePendlerpauschale(220, 30, TAX_YEAR_PARAMS[2026]);
      // 220 * 30 * 0,38 = 2508
      expect(r).toBe(2508);
    });

    it('sollte 2025 gestaffelt rechnen (km 1–20 zu 0,30, ab 21 zu 0,38)', () => {
      const r = computePendlerpauschale(220, 30, TAX_YEAR_PARAMS[2025]);
      // 220 * (20*0,30 + 10*0,38) = 220 * (6 + 3,8) = 220 * 9,8 = 2156
      expect(r).toBe(2156);
    });

    it('sollte 0 liefern, wenn Tage oder km fehlen', () => {
      expect(computePendlerpauschale(0, 30, TAX_YEAR_PARAMS[2025])).toBe(0);
      expect(computePendlerpauschale(220, 0, TAX_YEAR_PARAMS[2025])).toBe(0);
    });
  });

  describe('computeHomeofficePauschale', () => {
    it('sollte 6 €/Tag rechnen', () => {
      expect(computeHomeofficePauschale(100, TAX_YEAR_PARAMS[2025])).toBe(600);
    });

    it('sollte auf 210 Tage / 1.260 € deckeln', () => {
      expect(computeHomeofficePauschale(250, TAX_YEAR_PARAMS[2025])).toBe(1260);
    });
  });
});
