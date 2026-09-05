import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ONBOARDING_DRAFT_KEY,
  clearOnboardingDraft,
  readOnboardingDraft,
  writeOnboardingDraft,
} from '../onboarding-draft-store';

describe('onboarding-draft-store', () => {
  beforeEach(() => {
    // Zuerst die Attrappen zurücknehmen, dann räumen: der Fehler-Test unten
    // ersetzt `setItem`/`getItem`, und ein `clear()` davor liefe noch durch
    // die Attrappe.
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('sollte einen geschriebenen Entwurf unverändert zurücklesen', () => {
    writeOnboardingDraft({ step: 'premium', path: 'anonymous', displayName: 'Dana' });
    expect(readOnboardingDraft()).toEqual({
      step: 'premium',
      path: 'anonymous',
      displayName: 'Dana',
    });
  });

  it('sollte ohne gespeicherten Entwurf null liefern', () => {
    expect(readOnboardingDraft()).toBeNull();
  });

  it('sollte kaputtes JSON als „kein Entwurf" behandeln statt zu werfen', () => {
    window.localStorage.setItem(ONBOARDING_DRAFT_KEY, '{nicht wirklich json');
    expect(readOnboardingDraft()).toBeNull();
  });

  it('sollte einen strukturell ungültigen Entwurf verwerfen', () => {
    window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({ step: 'irgendwas' }));
    expect(readOnboardingDraft()).toBeNull();
  });

  it('sollte einen gesperrten Speicher überstehen, statt den Einstieg zu verhindern', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readOnboardingDraft()).toBeNull();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeOnboardingDraft({ step: 'sprache' })).not.toThrow();
  });

  it('sollte den Entwurf abräumen', () => {
    writeOnboardingDraft({ step: 'start' });
    clearOnboardingDraft();
    expect(readOnboardingDraft()).toBeNull();
  });
});
