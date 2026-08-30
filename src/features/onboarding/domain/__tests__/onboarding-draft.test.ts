import { describe, expect, it } from 'vitest';
import { safeParseAtBoundary } from '@/lib/schemas';
import { EMPTY_DRAFT, onboardingDraftSchema } from '../onboarding-draft';

function parse(value: unknown) {
  return safeParseAtBoundary(onboardingDraftSchema, value, 'onboarding-draft');
}

describe('onboardingDraftSchema', () => {
  it('sollte den leeren Entwurf annehmen', () => {
    expect(parse(EMPTY_DRAFT).ok).toBe(true);
  });

  it('sollte einen vollständigen Entwurf annehmen', () => {
    const result = parse({
      step: 'premium',
      path: 'anonymous',
      displayName: 'Dana',
      lifeSituation: 'employed_stable',
      modifiers: ['investing'],
      features: ['debts', 'budgets'],
      premiumSeen: true,
    });
    expect(result.ok).toBe(true);
  });

  it('sollte einen Entwurf ohne Schritt abweisen', () => {
    expect(parse({ path: 'anonymous' }).ok).toBe(false);
  });

  it('sollte einen unbekannten Schritt abweisen', () => {
    expect(parse({ step: 'zwischendurch' }).ok).toBe(false);
  });

  it('sollte einen unbekannten Bereich abweisen statt ihn zu übernehmen', () => {
    expect(parse({ step: 'bereiche', features: ['gibtsnicht'] }).ok).toBe(false);
  });

  it('sollte Müll abweisen, statt daran abzustürzen', () => {
    expect(parse(null).ok).toBe(false);
    expect(parse('sprache').ok).toBe(false);
    expect(parse(42).ok).toBe(false);
  });

  it('sollte einen übermäßig langen Anzeigenamen abweisen', () => {
    expect(parse({ step: 'begruessung', displayName: 'x'.repeat(81) }).ok).toBe(false);
  });
});
