import { describe, expect, it } from 'vitest';

import {
  ALWAYS_VISIBLE_NAV_PATHS,
  LIFE_SITUATIONS,
  MODIFIERS,
  NAV_FEATURE_PATHS,
  isBusinessModeEnabled,
  isFeatureEnabled,
  DEFAULT_OFF_FEATURES,
  resolveFeatureSelection,
  type LifeSituationId,
  type ModifierId,
  type NavFeatureId,
} from '../life-situations';
import { NAV_GROUPS } from '@/components/layout/nav-config';

const ALL_ARCHETYPE_IDS = LIFE_SITUATIONS.map((a) => a.id);
const ALL_MODIFIER_IDS = MODIFIERS.map((m) => m.id);
const ALL_FEATURE_IDS = Object.keys(NAV_FEATURE_PATHS) as NavFeatureId[];

describe('LifeSituationn-Katalog', () => {
  it('sollte eindeutige IDs vergeben', () => {
    expect(new Set(ALL_ARCHETYPE_IDS).size).toBe(LIFE_SITUATIONS.length);
    expect(new Set(ALL_MODIFIER_IDS).size).toBe(MODIFIERS.length);
  });

  it('sollte für jede Lebenssituation i18n-Keys statt fester Texte tragen', () => {
    for (const lifeSituation of LIFE_SITUATIONS) {
      expect(lifeSituation.labelKey).toBe(`onboarding.lifeSituations.${lifeSituation.id}.label`);
      expect(lifeSituation.descriptionKey).toBe(`onboarding.lifeSituations.${lifeSituation.id}.description`);
    }
    for (const modifier of MODIFIERS) {
      expect(modifier.labelKey).toBe(`onboarding.modifiers.${modifier.id}.label`);
    }
  });

  it('sollte jeder Lebenssituation mindestens einen Bereich zuordnen', () => {
    for (const lifeSituation of LIFE_SITUATIONS) {
      expect(lifeSituation.features.length).toBeGreaterThan(0);
    }
  });

  it('sollte die Auswahl auf höchstens 10 Kacheln halten (Onboarding bleibt überschaubar)', () => {
    expect(LIFE_SITUATIONS.length).toBeLessThanOrEqual(10);
  });

  it('sollte kein totes Feature führen — jeder Bereich wird von mindestens einer Lebenssituation vorausgewählt', () => {
    const covered = new Set(LIFE_SITUATIONS.flatMap((a) => a.features));
    for (const feature of ALL_FEATURE_IDS) {
      expect(covered.has(feature)).toBe(true);
    }
  });
});

describe('Feature-Katalog ↔ Navigation', () => {
  const navPaths = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.path);

  it('sollte jedes wählbare Feature auf ein existierendes Nav-Ziel abbilden', () => {
    for (const path of Object.values(NAV_FEATURE_PATHS)) {
      expect(navPaths).toContain(path);
    }
  });

  it('sollte keine Nav-Waisen lassen — jeder Pfad ist entweder Kern oder wählbares Feature', () => {
    const featurePaths = new Set<string>(Object.values(NAV_FEATURE_PATHS));
    const orphans = navPaths.filter(
      (p) => !featurePaths.has(p) && !ALWAYS_VISIBLE_NAV_PATHS.includes(p),
    );
    expect(orphans).toEqual([]);
  });

  it('sollte Kernbereiche NICHT wählbar machen (sie dürfen nie verschwinden)', () => {
    const featurePaths = Object.values(NAV_FEATURE_PATHS);
    for (const corePath of ALWAYS_VISIBLE_NAV_PATHS) {
      expect(featurePaths).not.toContain(corePath);
    }
  });

  it('sollte die mobilen Kernziele als immer sichtbar führen (sonst bricht die Bottom-Nav)', () => {
    expect(ALWAYS_VISIBLE_NAV_PATHS).toEqual(
      expect.arrayContaining(['/coach', '/dashboard', '/transactions']),
    );
  });

  it('sollte den Rückweg offenhalten — Einstellungen sind immer erreichbar', () => {
    expect(ALWAYS_VISIBLE_NAV_PATHS).toContain('/settings');
  });
});

describe('Opt-in-Bereiche (DEFAULT_OFF_FEATURES)', () => {
  it('sollte die EÜR ohne getroffene Auswahl verborgen halten („Ruhe vor Fülle")', () => {
    // Bestandsnutzer haben keine Auswahl getroffen. Ohne dieses Merkmal bekämen
    // sie die EÜR ungefragt eingeblendet, sobald der businessOnly-Sonderweg fällt.
    expect(isFeatureEnabled('euer', null)).toBe(false);
    expect(isBusinessModeEnabled(null)).toBe(false);
  });

  it('sollte alle übrigen Bereiche ohne Auswahl anzeigen', () => {
    for (const feature of ALL_FEATURE_IDS.filter((f) => !DEFAULT_OFF_FEATURES.includes(f))) {
      expect(isFeatureEnabled(feature, null)).toBe(true);
    }
  });

  it('sollte einen Opt-in-Bereich zeigen, sobald er ausdrücklich gewählt ist', () => {
    expect(isFeatureEnabled('euer', ['euer'])).toBe(true);
    expect(isBusinessModeEnabled(['euer'])).toBe(true);
  });

  it('sollte einen abgewählten Opt-in-Bereich verborgen halten', () => {
    expect(isFeatureEnabled('euer', ['budgets'])).toBe(false);
    expect(isBusinessModeEnabled(['budgets'])).toBe(false);
  });
});

describe('resolveFeatureSelection', () => {
  it('sollte die Vorauswahl der Lebenssituation liefern', () => {
    const { features } = resolveFeatureSelection('student_university', []);
    expect(features).toEqual(expect.arrayContaining(['liquidity', 'budgets', 'income']));
    expect(features).not.toContain('euer');
  });

  it('sollte Modifikatoren additiv anwenden', () => {
    const base = resolveFeatureSelection('student_school', []);
    const withInvesting = resolveFeatureSelection('student_school', ['investing']);
    expect(base.features).not.toContain('trading');
    expect(withInvesting.features).toContain('trading');
  });

  it('sollte durch Modifikatoren NIE etwas entfernen (Ergebnis bleibt erklärbar)', () => {
    for (const lifeSituation of ALL_ARCHETYPE_IDS) {
      const base = new Set(resolveFeatureSelection(lifeSituation, []).features);
      for (const modifier of ALL_MODIFIER_IDS) {
        const withModifier = resolveFeatureSelection(lifeSituation, [modifier]).features;
        for (const feature of base) {
          expect(withModifier).toContain(feature);
        }
      }
    }
  });

  it('sollte unabhängig von der Reihenfolge der Modifikatoren dasselbe Ergebnis liefern', () => {
    const forward = resolveFeatureSelection('family', ['investing', 'repaying_debt', 'commute']);
    const backward = resolveFeatureSelection('family', ['commute', 'repaying_debt', 'investing']);
    expect([...forward.features].sort()).toEqual([...backward.features].sort());
  });

  it('sollte doppelte Modifikatoren idempotent behandeln', () => {
    const once = resolveFeatureSelection('career_starter', ['investing']);
    const twice = resolveFeatureSelection('career_starter', ['investing', 'investing']);
    expect(twice.features).toEqual(once.features);
  });

  it('sollte unbekannte Modifikatoren ignorieren statt zu werfen', () => {
    const selection = resolveFeatureSelection('family', ['gibt-es-nicht' as ModifierId]);
    expect(selection.features).toEqual(resolveFeatureSelection('family', []).features);
  });

  it('sollte bei unbekannter Lebenssituation ALLE Bereiche freigeben statt auszusperren', () => {
    const selection = resolveFeatureSelection('kaputter-wert' as LifeSituationId, []);
    expect([...selection.features].sort()).toEqual([...ALL_FEATURE_IDS].sort());
  });

  it('sollte keine Duplikate in der Feature-Liste zurückgeben', () => {
    const { features } = resolveFeatureSelection('creator', ['side_business', 'irregular_income']);
    expect(new Set(features).size).toBe(features.length);
  });
});

describe('Situationsspezifische Vorauswahl', () => {
  it('sollte für Selbstständige die EÜR vorauswählen', () => {
    const { features, settings } = resolveFeatureSelection('self_employed', []);
    expect(features).toContain('euer');
    expect(settings.tax_reserve_percent).toBeGreaterThan(0);
  });

  it('sollte für Creator eine höhere Steuerrücklage vorschlagen als für Selbstständige', () => {
    const creator = resolveFeatureSelection('creator', []).settings;
    const selfEmployed = resolveFeatureSelection('self_employed', []).settings;
    expect(creator.tax_reserve_percent).toBeGreaterThan(selfEmployed.tax_reserve_percent ?? 0);
  });

  it('sollte den Einzelunternehmer-Modus aus der EÜR ableiten statt ihn separat zu führen', () => {
    for (const lifeSituation of LIFE_SITUATIONS) {
      const { features } = resolveFeatureSelection(lifeSituation.id, []);
      expect(isBusinessModeEnabled(features)).toBe(features.includes('euer'));
    }
  });

  it('sollte die EÜR auch über den Nebengewerbe-Modifikator einschalten', () => {
    const { features, settings } = resolveFeatureSelection('employed_stable', ['side_business']);
    expect(features).toContain('euer');
    expect(isBusinessModeEnabled(features)).toBe(true);
    // Ohne eigenen Vorschlag der Lebenssituation greift der Standardsatz.
    expect(settings.tax_reserve_percent).toBe(30);
  });

  it('sollte Schüler:innen bewusst schlank halten (kein Steuer-, EÜR- oder Depot-Ballast)', () => {
    const { features } = resolveFeatureSelection('student_school', []);
    expect(features).not.toContain('euer');
    expect(features).not.toContain('tax');
    expect(features).not.toContain('trading');
    expect(features).toContain('budgets');
    expect(features).toContain('contracts');
  });

  it('sollte beim Schuldenabbau die entlastenden Bereiche zeigen und Vermögensthemen weglassen', () => {
    const { features } = resolveFeatureSelection('debt_focus', []);
    expect(features).toEqual(expect.arrayContaining(['debts', 'liquidity', 'budgets', 'contracts']));
    expect(features).not.toContain('trading');
    expect(features).not.toContain('netWorth');
  });

  it('sollte für Alleinerziehende Schulden und tagesgenaue Liquidität vorsehen', () => {
    const { features } = resolveFeatureSelection('single_parent', []);
    expect(features).toEqual(expect.arrayContaining(['debts', 'liquidity', 'budgets', 'occasions']));
  });

  it('sollte für Familien die Anlässe (Urlaub, Weihnachten) vorauswählen', () => {
    expect(resolveFeatureSelection('family', []).features).toContain('occasions');
  });

  it('sollte im Ruhestand das Depot für die Entnahme sichtbar lassen', () => {
    const { features } = resolveFeatureSelection('retired', []);
    expect(features).toEqual(expect.arrayContaining(['trading', 'netWorth', 'liquidity']));
    expect(features).not.toContain('euer');
  });

  it('sollte den sanften Ton nur für belastende Situationen vorschlagen', () => {
    expect(resolveFeatureSelection('debt_focus', []).settings.gentle_mode).toBe(true);
    expect(resolveFeatureSelection('single_parent', []).settings.gentle_mode).toBe(true);
    expect(resolveFeatureSelection('employed_stable', []).settings.gentle_mode).toBeFalsy();
  });
});
