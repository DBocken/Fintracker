import { describe, it, expect } from 'vitest';
import {
  proposeOnboarding,
  NEVER_PROPOSED_SITUATIONS,
  type OnboardingSignals,
} from '../onboarding-proposal';
import { LIFE_SITUATIONS } from '../life-situations';

/**
 * Vorschlag der Lebenssituation aus den importierten Daten
 * (`docs/tutorial-sequence.md`, Kapitel 0 → Onboarding).
 *
 * Die Tests halten vor allem fest, was **nicht** vorgeschlagen wird: Aus einem
 * Kontoauszug eine Lebenslage abzulesen und sie dem Nutzer als „das bist du"
 * vorzusetzen, ist genau die Etikettierung, die `onboarding-life-situations.md`
 * ausschließt.
 */

const nothing: OnboardingSignals = {
  hasRegularSalary: false,
  hasSelfEmployedIncome: false,
  hasPensionIncome: false,
  incomeVaries: false,
  hasDebts: false,
  hasInvestments: false,
};

describe('proposeOnboarding — Lebenssituation', () => {
  it('sollte ohne Signale nichts vorschlagen', () => {
    expect(proposeOnboarding(nothing)).toEqual({ lifeSituation: null, modifiers: [] });
  });

  it('sollte bei erkanntem Gehalt eine Anstellung vorschlagen', () => {
    const { lifeSituation } = proposeOnboarding({ ...nothing, hasRegularSalary: true });
    expect(lifeSituation).toBe('employed_stable');
  });

  it('sollte bei Selbstständigen-Einnahmen ohne Gehalt Selbstständigkeit vorschlagen', () => {
    const { lifeSituation } = proposeOnboarding({ ...nothing, hasSelfEmployedIncome: true });
    expect(lifeSituation).toBe('self_employed');
  });

  it('sollte bei Rente ohne Gehalt den Ruhestand vorschlagen', () => {
    const { lifeSituation } = proposeOnboarding({ ...nothing, hasPensionIncome: true });
    expect(lifeSituation).toBe('retired');
  });

  it('sollte Gehalt neben Selbstständigkeit als Anstellung mit Nebenerwerb lesen', () => {
    // Selbstständigen-Einnahmen *neben* einem Gehalt sind ein Nebengewerbe,
    // nicht die Lebensgrundlage — deshalb Modifikator statt Lebenssituation.
    const { lifeSituation, modifiers } = proposeOnboarding({
      ...nothing,
      hasRegularSalary: true,
      hasSelfEmployedIncome: true,
    });
    expect(lifeSituation).toBe('employed_stable');
    expect(modifiers).toContain('side_business');
  });

  it('sollte niemals eine belastende Lebenslage aus Daten ableiten', () => {
    // Schulden, Alleinerziehung, Familie: aus Buchungen geraten und als
    // Selbstbeschreibung vorgesetzt wäre das eine Zuschreibung, keine Hilfe.
    const everything: OnboardingSignals = {
      hasRegularSalary: true,
      hasSelfEmployedIncome: true,
      hasPensionIncome: true,
      incomeVaries: true,
      hasDebts: true,
      hasInvestments: true,
    };
    for (const signals of [everything, { ...nothing, hasDebts: true }]) {
      const { lifeSituation } = proposeOnboarding(signals);
      expect(NEVER_PROPOSED_SITUATIONS).not.toContain(lifeSituation);
    }
  });

  it('sollte nur Lebenssituationen vorschlagen, die es wirklich gibt', () => {
    const known = LIFE_SITUATIONS.map((s) => s.id);
    const cases: OnboardingSignals[] = [
      { ...nothing, hasRegularSalary: true },
      { ...nothing, hasSelfEmployedIncome: true },
      { ...nothing, hasPensionIncome: true },
    ];
    for (const signals of cases) {
      expect(known).toContain(proposeOnboarding(signals).lifeSituation);
    }
  });
});

describe('proposeOnboarding — Umstände', () => {
  it('sollte Schulden als Handlung vorschlagen, nicht als Zustand', () => {
    // `repaying_debt` ist als Tun formuliert („Ich zahle ab"), `debt_focus`
    // als Lage. Aus Daten darf nur Ersteres kommen.
    const { lifeSituation, modifiers } = proposeOnboarding({ ...nothing, hasDebts: true });
    expect(modifiers).toContain('repaying_debt');
    expect(lifeSituation).not.toBe('debt_focus');
  });

  it('sollte ein Depot als Anlage-Umstand vorschlagen', () => {
    expect(proposeOnboarding({ ...nothing, hasInvestments: true }).modifiers).toContain('investing');
  });

  it('sollte schwankende Einnahmen als Umstand vorschlagen', () => {
    expect(proposeOnboarding({ ...nothing, incomeVaries: true }).modifiers).toContain(
      'irregular_income',
    );
  });

  it('sollte keinen Nebenerwerb vorschlagen, wenn die Selbstständigkeit die Grundlage ist', () => {
    const { modifiers } = proposeOnboarding({ ...nothing, hasSelfEmployedIncome: true });
    expect(modifiers).not.toContain('side_business');
  });

  it('sollte Umstände ohne Dubletten und stabil sortiert liefern', () => {
    const { modifiers } = proposeOnboarding({
      ...nothing,
      hasDebts: true,
      hasInvestments: true,
      incomeVaries: true,
    });
    expect(new Set(modifiers).size).toBe(modifiers.length);
    expect(modifiers).toEqual([...modifiers].sort());
  });
});
