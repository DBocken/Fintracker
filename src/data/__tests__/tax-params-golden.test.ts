import { describe, it, expect } from 'vitest';
import { TAX_YEAR_PARAMS, TAX_PARAM_LEGAL_BASIS, type NumericParam } from '../tax-catalog';

/**
 * Golden Table: pinnt die AUFGELÖSTEN Jahresparameter je Veranlagungszeitraum
 * als vollständige Literale.
 *
 * Zweck (Audit): Jede Wertänderung — auch ein versehentlicher Edit an
 * CONSTANT_PARAMS, der rückwirkend vergangene VZ ändern würde — macht die
 * betroffenen Jahres-Assertions rot, bis ein Reviewer das Literal BEWUSST
 * anpasst. Diese Datei ist damit zugleich die CI-erzwungene, menschenlesbare
 * Parametertabelle. Prozess für neue Jahre: docs/tax-year-update.md.
 */

describe('Golden Table: TAX_YEAR_PARAMS', () => {
  it('VZ 2024: vollständige amtliche Parameter', () => {
    expect(TAX_YEAR_PARAMS[2024]).toEqual({
      vz: 2024,
      arbeitnehmerPauschbetrag: 1230,
      sonderausgabenPauschbetrag: 36,
      homeofficeProTag: 6,
      homeofficeMaxTage: 210,
      homeofficeMax: 1260,
      pendlerKm1bis20: 0.3,
      pendlerAbKm21: 0.38,
      // VZ 2024: Kinderbetreuung noch 2/3 von max. 6.000 € = 4.000 € Abzug.
      kinderbetreuungRate: 2 / 3,
      kinderbetreuungMaxProKind: 4000,
      schulgeldRate: 0.3,
      schulgeldMax: 5000,
      riesterMax: 2100,
      vorsorgeMaxArbeitnehmer: 1900,
      vorsorgeMaxSelbst: 2800,
      unterhaltExPartnerMax: 13805,
      erstausbildungMax: 6000,
      kontofuehrungPauschale: 16,
      creditRate35a: 0.2,
      a35a1CapCosts: 2550,
      a35a1CapCredit: 510,
      a35a2CapCosts: 20000,
      a35a2CapCredit: 4000,
      a35a3CapCosts: 6000,
      a35a3CapCredit: 1200,
      creditRate35c: 0.2,
      a35cCapCredit: 40000,
    });
  });

  it('VZ 2025: vollständige amtliche Parameter', () => {
    expect(TAX_YEAR_PARAMS[2025]).toEqual({
      vz: 2025,
      arbeitnehmerPauschbetrag: 1230,
      sonderausgabenPauschbetrag: 36,
      homeofficeProTag: 6,
      homeofficeMaxTage: 210,
      homeofficeMax: 1260,
      pendlerKm1bis20: 0.3,
      pendlerAbKm21: 0.38,
      // Ab VZ 2025: 80 % von max. 6.000 € = 4.800 € Abzug (JStG 2024).
      kinderbetreuungRate: 0.8,
      kinderbetreuungMaxProKind: 4800,
      schulgeldRate: 0.3,
      schulgeldMax: 5000,
      riesterMax: 2100,
      vorsorgeMaxArbeitnehmer: 1900,
      vorsorgeMaxSelbst: 2800,
      unterhaltExPartnerMax: 13805,
      erstausbildungMax: 6000,
      kontofuehrungPauschale: 16,
      creditRate35a: 0.2,
      a35a1CapCosts: 2550,
      a35a1CapCredit: 510,
      a35a2CapCosts: 20000,
      a35a2CapCredit: 4000,
      a35a3CapCosts: 6000,
      a35a3CapCredit: 1200,
      creditRate35c: 0.2,
      a35cCapCredit: 40000,
    });
  });

  it('VZ 2026: vollständige amtliche Parameter', () => {
    expect(TAX_YEAR_PARAMS[2026]).toEqual({
      vz: 2026,
      arbeitnehmerPauschbetrag: 1230,
      sonderausgabenPauschbetrag: 36,
      homeofficeProTag: 6,
      homeofficeMaxTage: 210,
      homeofficeMax: 1260,
      // StÄndG 2025: einheitlich 0,38 €/km ab dem 1. km.
      pendlerKm1bis20: 0.38,
      pendlerAbKm21: 0.38,
      kinderbetreuungRate: 0.8,
      kinderbetreuungMaxProKind: 4800,
      schulgeldRate: 0.3,
      schulgeldMax: 5000,
      riesterMax: 2100,
      vorsorgeMaxArbeitnehmer: 1900,
      vorsorgeMaxSelbst: 2800,
      unterhaltExPartnerMax: 13805,
      erstausbildungMax: 6000,
      kontofuehrungPauschale: 16,
      creditRate35a: 0.2,
      a35a1CapCosts: 2550,
      a35a1CapCredit: 510,
      a35a2CapCosts: 20000,
      a35a2CapCredit: 4000,
      a35a3CapCosts: 6000,
      a35a3CapCredit: 1200,
      creditRate35c: 0.2,
      a35cCapCredit: 40000,
    });
  });

  // Bewusst EXAKTE Gleichheit (kein >=): auch das HINZUFÜGEN eines Jahres failt
  // hier absichtlich und zwingt in diese Datei — der Horizont wird nur zusammen
  // mit einem neuen Golden-Literal angehoben (Prozess: docs/tax-year-update.md).
  // Kein Datums-„Wecker" (new Date()): der wäre nicht-deterministisch und ab dem
  // 1.1. eines nicht verkündeten VZ unbehebbar rot; die Nutzer-Warnung liefert
  // getTaxParams(exact:false) → tax.page.paramsClamped bereits zur Laufzeit.
  it('deckt genau die VZ 2024–2026 ab (Horizont beim Jahres-Update bewusst anheben)', () => {
    expect(
      Object.keys(TAX_YEAR_PARAMS)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([2024, 2025, 2026]);
  });
});

describe('Rechtsgrundlagen', () => {
  it('nennt für jeden Parameter eine nicht-leere Fundstelle (§/EStG/LStH)', () => {
    const params = Object.keys(TAX_PARAM_LEGAL_BASIS) as NumericParam[];
    expect(params.length).toBeGreaterThan(0);
    for (const p of params) {
      const basis = TAX_PARAM_LEGAL_BASIS[p];
      expect(basis.law.trim().length, `law fehlt für ${p}`).toBeGreaterThan(0);
      // Der Typ erzwingt Vollständigkeit; hier fangen wir leere Platzhalter ab.
      expect(/§|EStG|LStH|BMF/.test(basis.law), `law für ${p} ohne Fundstelle: "${basis.law}"`).toBe(true);
    }
  });
});

describe('Musterrechnung Kinderbetreuung (Parameter-Ebene)', () => {
  // Die Kinderbetreuungs-Regel ist Anzeige-Metadatum (TaxCategory.rule) — kein
  // Code rechnet sie End-to-End. Die Musterrechnung prüft daher die PARAMETER:
  // Abzug = min(rate × gezahlt, Abzugs-Höchstbetrag).
  it('6.500 € gezahlt → 4.800 € Abzug (VZ 2025) bzw. 4.000 € (VZ 2024)', () => {
    const paid = 6500;

    // VZ 2025: min(0,8 × 6.500; 4.800) = min(5.200; 4.800) = 4.800 €
    const p25 = TAX_YEAR_PARAMS[2025];
    expect(Math.min(p25.kinderbetreuungRate * paid, p25.kinderbetreuungMaxProKind)).toBe(4800);

    // VZ 2024: min(2/3 × 6.500; 4.000) = min(4.333,33…; 4.000) = 4.000 €
    const p24 = TAX_YEAR_PARAMS[2024];
    expect(Math.min(p24.kinderbetreuungRate * paid, p24.kinderbetreuungMaxProKind)).toBe(4000);
  });
});
