import { describe, expect, it } from 'vitest';
import { buildOnboardingSettings } from '../onboarding-commit';

describe('buildOnboardingSettings', () => {
  it('sollte die Auswahl vollständig in einen einzigen Patch übersetzen', () => {
    const patch = buildOnboardingSettings({
      draft: {
        step: 'start',
        path: 'anonymous',
        displayName: 'Dana',
        lifeSituation: 'employed_stable',
        modifiers: ['investing'],
        features: ['debts', 'budgets'],
      },
      source: 'demo',
    });

    expect(patch.onboarding_life_situation).toBe('employed_stable');
    expect(patch.onboarding_modifiers).toEqual(['investing']);
    expect(patch.enabled_nav_features).toEqual(['debts', 'budgets']);
    expect(patch.display_name).toBe('Dana');
    expect(patch.tutorial_source).toBe('demo');
  });

  it('sollte ohne eigene Bereichswahl den Vorschlag der Lebenssituation übernehmen', () => {
    const patch = buildOnboardingSettings({
      draft: { step: 'start', lifeSituation: 'self_employed', modifiers: [] },
      source: null,
    });
    expect(patch.enabled_nav_features).toContain('euer');
  });

  it('sollte ohne Lebenssituation die Navigation vollständig lassen', () => {
    const patch = buildOnboardingSettings({ draft: { step: 'start' }, source: null });
    expect(patch.onboarding_life_situation).toBeNull();
    expect(patch.enabled_nav_features).toBeNull();
  });

  it('sollte einen leeren Anzeigenamen als „nicht beantwortet" speichern', () => {
    const patch = buildOnboardingSettings({
      draft: { step: 'start', displayName: '   ' },
      source: null,
    });
    expect(patch.display_name).toBeNull();
  });

  it('sollte den Steuerrücklage-Vorschlag der Lebenssituation mitführen', () => {
    const patch = buildOnboardingSettings({
      draft: { step: 'start', lifeSituation: 'employed_stable', modifiers: ['side_business'] },
      source: null,
    });
    expect(patch.tax_reserve_percent).toBeGreaterThan(0);
  });
});
