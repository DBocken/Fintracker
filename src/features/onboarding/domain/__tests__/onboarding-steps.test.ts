import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_STEPS,
  isOnboardingStep,
  nextStep,
  prevStep,
  resolveStartStep,
  stepsForPath,
} from '../onboarding-steps';
import type { OnboardingDraft } from '../onboarding-draft';

const angemeldet = { authenticated: true, hasAccess: true };
const abgemeldet = { authenticated: false, hasAccess: false };
const anonymDrin = { authenticated: false, hasAccess: true };

function entwurf(teil: Partial<OnboardingDraft>): OnboardingDraft {
  return { step: 'sprache', ...teil };
}

describe('stepsForPath', () => {
  it('sollte für den anonymen Weg die Anmeldeseite auslassen', () => {
    expect(stepsForPath('anonymous')).not.toContain('anmeldung');
    expect(stepsForPath('anonymous')).toHaveLength(ONBOARDING_STEPS.length - 1);
  });

  it('sollte für den Konto-Weg alle Schritte führen', () => {
    expect(stepsForPath('account')).toEqual([...ONBOARDING_STEPS]);
  });

  it('sollte ohne gewählten Weg nichts vorwegnehmen', () => {
    expect(stepsForPath(undefined)).toEqual([...ONBOARDING_STEPS]);
  });
});

describe('nextStep / prevStep', () => {
  it('sollte anonym von der Wegwahl direkt zur Begrüßung führen', () => {
    expect(nextStep('weg', 'anonymous')).toBe('begruessung');
  });

  it('sollte mit Konto von der Wegwahl zur Anmeldung führen', () => {
    expect(nextStep('weg', 'account')).toBe('anmeldung');
  });

  it('sollte am Ende des Flusses null liefern', () => {
    expect(nextStep('start', 'anonymous')).toBeNull();
  });

  it('sollte am Anfang des Flusses null liefern', () => {
    expect(prevStep('sprache', 'anonymous')).toBeNull();
  });

  it('sollte anonym von der Begrüßung zurück zur Wegwahl führen', () => {
    expect(prevStep('begruessung', 'anonymous')).toBe('weg');
  });
});

describe('resolveStartStep', () => {
  it('sollte ohne Entwurf bei der Sprachwahl beginnen', () => {
    expect(resolveStartStep(null, abgemeldet)).toBe('sprache');
  });

  it('sollte ohne gewählten Weg höchstens die Wegwahl zulassen', () => {
    // Ein Entwurf, der weiter behauptet zu sein, als er trägt: die URL ist
    // frei tippbar, die Sperre gehört deshalb hierher.
    expect(resolveStartStep(entwurf({ step: 'bereiche' }), abgemeldet)).toBe('weg');
  });

  it('sollte nach der Rückkehr vom Anbieter hinter der Anmeldung weitermachen', () => {
    const draft = entwurf({ step: 'anmeldung', path: 'account' });
    expect(resolveStartStep(draft, angemeldet)).toBe('begruessung');
  });

  it('sollte ohne bestehende Anmeldung auf der Anmeldeseite bleiben', () => {
    const draft = entwurf({ step: 'begruessung', path: 'account' });
    expect(resolveStartStep(draft, abgemeldet)).toBe('anmeldung');
  });

  it('sollte einen Bestandsnutzer ohne Entwurf bei der Lebenssituation aufsetzen', () => {
    // „Situation neu wählen" in den Einstellungen: Sprache und Weg sind
    // entschiedene Tatsachen, danach zu fragen wäre Gedächtnisverlust.
    expect(resolveStartStep(null, anonymDrin)).toBe('situation');
  });

  it('sollte die Begrüßung nicht überspringen, nur weil anonym gestartet wurde', () => {
    // `hasAccess` wird schon in Schritt 2 wahr — die untere Schranke des
    // Bestandsnutzers darf deshalb nur OHNE Entwurf greifen, sonst wäre der
    // Schritt unmittelbar danach unerreichbar.
    const draft = entwurf({ step: 'begruessung', path: 'anonymous' });
    expect(resolveStartStep(draft, anonymDrin)).toBe('begruessung');
  });

  it('sollte beim Neuladen mitten im Fluss denselben Schritt liefern', () => {
    const draft = entwurf({ step: 'premium', path: 'anonymous' });
    expect(resolveStartStep(draft, abgemeldet)).toBe('premium');
  });
});

describe('isOnboardingStep', () => {
  it('sollte nur bekannte Schritte annehmen', () => {
    expect(isOnboardingStep('sprache')).toBe(true);
    expect(isOnboardingStep('gibtsnicht')).toBe(false);
    expect(isOnboardingStep(undefined)).toBe(false);
  });
});
