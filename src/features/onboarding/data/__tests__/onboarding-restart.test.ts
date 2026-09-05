import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANONYMOUS_MODE_KEY } from '@/lib/anonymous-mode';
import { readOnboardingDraft } from '../onboarding-draft-store';
import { restartOnboarding } from '../onboarding-restart';

const updateUserSettings = vi.fn();
vi.mock('@/services/user-settings-service', () => ({
  updateUserSettings: (patch: unknown) => updateUserSettings(patch),
}));

describe('restartOnboarding', () => {
  beforeEach(() => {
    window.localStorage.clear();
    updateUserSettings.mockReset();
    updateUserSettings.mockResolvedValue({});
  });

  it('sollte den Fluss ganz vorn aufsetzen lassen, nicht bei der Lebenssituation', async () => {
    // Ohne Entwurf griffe `firstRunStep` und begänne bei der Situation, weil
    // der Nutzer ja schon in der App ist. Genau das will hier niemand.
    window.localStorage.setItem(ANONYMOUS_MODE_KEY, 'true');
    await restartOnboarding();
    expect(readOnboardingDraft()).toEqual({ step: 'sprache' });
  });

  it('sollte den anonymen Merker zurücknehmen', async () => {
    // Sonst wäre die Wegwahl eine Frage ohne Folgen.
    window.localStorage.setItem(ANONYMOUS_MODE_KEY, 'true');
    await restartOnboarding();
    expect(window.localStorage.getItem(ANONYMOUS_MODE_KEY)).toBeNull();
  });

  it('sollte die Antworten des Einstiegs auf „nie gefragt" setzen', async () => {
    await restartOnboarding();
    expect(updateUserSettings).toHaveBeenCalledTimes(1);
    const patch = updateUserSettings.mock.calls[0][0] as Record<string, unknown>;
    // `undefined` = nie gefragt. `null` waere „gefragt und uebersprungen" und
    // liesse den Einstieg aus.
    expect(patch.onboarding_life_situation).toBeUndefined();
    expect('onboarding_life_situation' in patch).toBe(true);
    expect('display_name' in patch).toBe(true);
    expect('tutorial_source' in patch).toBe(true);
  });

  it('[REGRESSION] sollte KEINE Finanzdaten anfassen', async () => {
    // Der Unterschied zwischen „Einrichtung neu" und „Daten löschen".
    window.localStorage.setItem('ausgabentracker_transactions_v3', '[{"id":"x"}]');
    await restartOnboarding();
    expect(window.localStorage.getItem('ausgabentracker_transactions_v3')).toBe('[{"id":"x"}]');
    const patch = updateUserSettings.mock.calls[0][0] as Record<string, unknown>;
    expect('enabled_nav_features' in patch).toBe(false);
    expect('unlocked_features' in patch).toBe(false);
    expect('tutorial_completed_chapters' in patch).toBe(false);
  });
});

describe('enterOnboardingAtSignIn', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('sollte den Fluss beim Anmelde-Schritt aufsetzen, nicht bei der Lebenssituation', async () => {
    // `/login` heisst „ich will mich anmelden". Ohne diesen Entwurf griffe
    // `firstRunStep` und fragte einen anonym gestarteten Nutzer nach seiner
    // Lebenssituation.
    const { enterOnboardingAtSignIn } = await import('../onboarding-restart');
    enterOnboardingAtSignIn();
    expect(readOnboardingDraft()).toEqual({ step: 'anmeldung', path: 'account' });
  });

  it('sollte den anonymen Merker NICHT anfassen', async () => {
    // Bricht er die Anmeldung ab, ist er weiterhin in der App.
    window.localStorage.setItem(ANONYMOUS_MODE_KEY, 'true');
    const { enterOnboardingAtSignIn } = await import('../onboarding-restart');
    enterOnboardingAtSignIn();
    expect(window.localStorage.getItem(ANONYMOUS_MODE_KEY)).toBe('true');
  });
});
