import { describe, expect, it, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test-utils/render';
import { findFeatureSwitch } from '@/test-utils/feature-switch';
import OnboardingDialog from '../OnboardingDialog';
import { getLocalUserSettings, updateLocalUserSettings } from '@/services/local-settings-service';
import { localEncryption } from '@/services/local-crypto';
import { isBusinessModeEnabled, resolveFeatureSelection } from '@/lib/life-situations';
import { collectOnboardingSignals } from '@/services/onboarding-signals-service';

vi.mock('@/services/onboarding-signals-service', () => ({
  collectOnboardingSignals: vi.fn().mockResolvedValue({
    hasRegularSalary: false,
    hasSelfEmployedIncome: false,
    hasPensionIncome: false,
    incomeVaries: false,
    hasDebts: false,
    hasInvestments: false,
  }),
}));

const { startAllMock } = vi.hoisted(() => ({ startAllMock: vi.fn() }));
vi.mock('@/hooks/useTutorialControl', () => ({
  useTutorialControl: () => ({ start: vi.fn(), startSeries: vi.fn(), startAll: startAllMock, active: false }),
}));

beforeEach(async () => {
  localStorage.clear();
  localEncryption.lock();
  startAllMock.mockClear();
  // Der Dialog wartet seit der Datenquellen-Weiche (Kapitel 0) darauf, dass
  // dort entschieden ist. Diese Suite prueft die Situationswahl, nicht die
  // Weiche — deshalb die Vorbedingung hier einmal setzen.
  await updateLocalUserSettings({ tutorial_source: 'csv' });
});

/** Führt bis zum dritten Schritt („Tutorial durchgehen oder selbst erkunden?"). */
async function goToTutorialStep(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Welche Situation beschreibt dich am ehesten?');
  await user.click(screen.getByRole('radio', { name: /Familie mit Kindern/ }));
  await user.click(screen.getByRole('button', { name: 'Weiter' }));
  await user.click(await screen.findByRole('button', { name: 'Weiter' }));
}

function renderDialog(locale: 'de' | 'en' = 'de') {
  return renderWithProviders(<OnboardingDialog />, { locale, query: true });
}

describe('OnboardingDialog', () => {
  it('sollte sich für Nutzer öffnen, die noch nicht gefragt wurden', async () => {
    renderDialog();
    expect(
      await screen.findByText('Welche Situation beschreibt dich am ehesten?'),
    ).toBeInTheDocument();
  });

  it('sollte geschlossen bleiben, wenn die Frage bereits beantwortet wurde', async () => {
    await updateLocalUserSettings({ onboarding_life_situation: 'family' });
    renderDialog();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('[REGRESSION] sollte geschlossen bleiben, wenn zuvor bewusst übersprungen wurde', async () => {
    // null = „gefragt, aber abgelehnt". Ohne diese Unterscheidung würde der
    // Dialog bei jedem App-Start erneut aufpoppen.
    await updateLocalUserSettings({ onboarding_life_situation: null });
    renderDialog();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sollte erst nach der Auswahl einer Situation weitergehen lassen', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText('Welche Situation beschreibt dich am ehesten?');

    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /Familie mit Kindern/ }));
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeEnabled();
  });

  it('sollte im zweiten Schritt die Bereiche der Lebenssituation vorselektieren', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText('Welche Situation beschreibt dich am ehesten?');

    await user.click(screen.getByRole('radio', { name: /Schulden abbauen/ }));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(await findFeatureSwitch('debts')).toBeChecked();
    expect(await findFeatureSwitch('trading')).not.toBeChecked();
  });

  it('sollte gewählte Umstände in der Vorauswahl berücksichtigen', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText('Welche Situation beschreibt dich am ehesten?');

    await user.click(screen.getByRole('radio', { name: /Schulden abbauen/ }));
    await user.click(screen.getByRole('checkbox', { name: /Ich lege Geld an/ }));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(await findFeatureSwitch('trading')).toBeChecked();
  });

  it('sollte die bestätigte Auswahl samt abgeleiteter Einstellungen speichern', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText('Welche Situation beschreibt dich am ehesten?');

    await user.click(screen.getByRole('radio', { name: /Selbstständig oder freiberuflich/ }));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    await user.click(await screen.findByRole('button', { name: 'Weiter' }));
    await user.click(await screen.findByText('Selbst erkunden'));

    await waitFor(async () => {
      const settings = await getLocalUserSettings();
      expect(settings.onboarding_life_situation).toBe('self_employed');
      expect(settings.enabled_nav_features).toEqual(
        resolveFeatureSelection('self_employed', []).features,
      );
      // Der Einzelunternehmer-Modus wird abgeleitet, nicht als zweites Flag
      // gespeichert — die gewählte EÜR ist die einzige Quelle.
      expect(isBusinessModeEnabled(settings.enabled_nav_features)).toBe(true);
      expect(settings.business_mode).toBeUndefined();
      expect(settings.tax_reserve_percent).toBe(30);
    });
  });

  it('sollte manuelle Änderungen im zweiten Schritt speichern, nicht die reine Vorauswahl', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText('Welche Situation beschreibt dich am ehesten?');

    await user.click(screen.getByRole('radio', { name: /Schulden abbauen/ }));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    await user.click(await findFeatureSwitch('trading'));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    await user.click(await screen.findByText('Selbst erkunden'));

    await waitFor(async () => {
      const settings = await getLocalUserSettings();
      expect(settings.enabled_nav_features).toContain('trading');
    });
  });

  it('sollte beim Überspringen alles sichtbar lassen', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText('Welche Situation beschreibt dich am ehesten?');

    await user.click(screen.getByRole('button', { name: 'Später entscheiden' }));

    await waitFor(async () => {
      const settings = await getLocalUserSettings();
      expect(settings.onboarding_life_situation).toBeNull();
      // Keine Bereichsauswahl ⇒ die Navigation bleibt vollständig.
      expect(settings.enabled_nav_features ?? null).toBeNull();
    });
  });

  it('sollte per Zurück wieder zur Situationswahl führen', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText('Welche Situation beschreibt dich am ehesten?');

    await user.click(screen.getByRole('radio', { name: /Ruhestand/ }));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    await user.click(await screen.findByRole('button', { name: 'Zurück' }));

    expect(screen.getByRole('radio', { name: /Ruhestand/ })).toBeChecked();
  });

  it('sollte englisch durch denselben Ablauf führen', async () => {
    const user = userEvent.setup();
    renderDialog('en');
    await screen.findByText('Which situation describes you best?');

    await user.click(screen.getByRole('radio', { name: /Retired/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Here is what we suggest')).toBeInTheDocument();
  });
});

describe('OnboardingDialog — Tutorial: durchgehen oder selbst erkunden', () => {
  it('sollte nach der Bereichsauswahl die Tutorial-Frage samit Hinweis auf das Fortsetzen zeigen', async () => {
    const user = userEvent.setup();
    renderDialog();
    await goToTutorialStep(user);

    expect(await screen.findByText('Noch eine Frage, bevor es losgeht')).toBeInTheDocument();
    expect(screen.getByText('Tutorial durchgehen')).toBeInTheDocument();
    expect(screen.getByText('Selbst erkunden')).toBeInTheDocument();
    // Der Hinweis, dass das Tutorial jederzeit nachholbar ist — sonst wirkt
    // „selbst erkunden" wie eine endgültige Entscheidung.
    expect(
      screen.getByText(/Du kannst das Tutorial jederzeit über das Symbol/),
    ).toBeInTheDocument();
  });

  it('sollte bei „Tutorial durchgehen" die geführte Tour starten und die Auswahl speichern', async () => {
    const user = userEvent.setup();
    renderDialog();
    await goToTutorialStep(user);

    await user.click(await screen.findByText('Tutorial durchgehen'));

    await waitFor(() => expect(startAllMock).toHaveBeenCalledTimes(1));
    await waitFor(async () => {
      const settings = await getLocalUserSettings();
      expect(settings.onboarding_life_situation).toBe('family');
    });
  });

  it('[REGRESSION] sollte bei „Selbst erkunden" die Auswahl speichern, ohne die Tour zu starten', async () => {
    const user = userEvent.setup();
    renderDialog();
    await goToTutorialStep(user);

    await user.click(await screen.findByText('Selbst erkunden'));

    await waitFor(async () => {
      const settings = await getLocalUserSettings();
      expect(settings.onboarding_life_situation).toBe('family');
    });
    expect(startAllMock).not.toHaveBeenCalled();
  });

  it('sollte von der Tutorial-Frage per Zurück zur Bereichsauswahl führen', async () => {
    const user = userEvent.setup();
    renderDialog();
    await goToTutorialStep(user);

    await user.click(await screen.findByRole('button', { name: 'Zurück' }));

    expect(await screen.findByText('Das schlagen wir dir vor')).toBeInTheDocument();
  });
});

describe('OnboardingDialog — Reihenfolge nach der Datenquellen-Weiche', () => {
  it('sollte warten, solange die Datenquelle noch nicht entschieden ist', async () => {
    // Zwei offene Dialoge gleichzeitig wären eine Zumutung — und die
    // Lebenssituation lässt sich erst aus vorhandenen Daten vorschlagen.
    localStorage.clear(); // Vorbedingung aus beforeEach zuruecknehmen
    renderWithProviders(<OnboardingDialog />, { locale: 'de', query: true });
    await waitFor(() => {
      expect(
        screen.queryByText('Welche Situation beschreibt dich am ehesten?'),
      ).not.toBeInTheDocument();
    });
  });

  it('sollte nach entschiedener Datenquelle nach der Lebenssituation fragen', async () => {
    await updateLocalUserSettings({ tutorial_source: 'csv' });
    renderWithProviders(<OnboardingDialog />, { locale: 'de', query: true });
    expect(
      await screen.findByText('Welche Situation beschreibt dich am ehesten?'),
    ).toBeInTheDocument();
  });

  it('sollte auch nach übersprungener Datenquelle weitermachen', async () => {
    await updateLocalUserSettings({ tutorial_source: null });
    renderWithProviders(<OnboardingDialog />, { locale: 'de', query: true });
    expect(
      await screen.findByText('Welche Situation beschreibt dich am ehesten?'),
    ).toBeInTheDocument();
  });
});

describe('OnboardingDialog — Vorbelegung aus den Daten', () => {
  it('sollte die Situation aus erkannten Daten vorbelegen und das kenntlich machen', async () => {
    vi.mocked(collectOnboardingSignals).mockResolvedValue({
      hasRegularSalary: true,
      hasSelfEmployedIncome: false,
      hasPensionIncome: false,
      incomeVaries: false,
      hasDebts: true,
      hasInvestments: false,
    });
    renderDialog();
    // Eine unerklärte Vorauswahl wirkt wie Überwachung; erst der Hinweis macht
    // sie zu einem Angebot.
    expect(await screen.findByText(/Aus deinen Daten geschätzt/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Weiter/ })).toBeEnabled();
    });
  });

  it('sollte ohne belastbares Signal nichts vorbelegen', async () => {
    vi.mocked(collectOnboardingSignals).mockResolvedValue({
      hasRegularSalary: false,
      hasSelfEmployedIncome: false,
      hasPensionIncome: false,
      incomeVaries: false,
      hasDebts: false,
      hasInvestments: false,
    });
    renderDialog();
    await screen.findByText('Welche Situation beschreibt dich am ehesten?');
    expect(screen.queryByText(/Aus deinen Daten geschätzt/)).not.toBeInTheDocument();
    // „Weiter" bleibt gesperrt, solange nichts gewählt ist.
    expect(screen.getByRole('button', { name: /Weiter/ })).toBeDisabled();
  });

  it('sollte auf Englisch denselben Hinweis geben', async () => {
    vi.mocked(collectOnboardingSignals).mockResolvedValue({
      hasRegularSalary: true,
      hasSelfEmployedIncome: false,
      hasPensionIncome: false,
      incomeVaries: false,
      hasDebts: false,
      hasInvestments: false,
    });
    renderDialog('en');
    expect(await screen.findByText(/Estimated from your data/)).toBeInTheDocument();
  });
});
