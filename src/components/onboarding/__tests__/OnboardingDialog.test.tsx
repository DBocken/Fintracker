import { describe, expect, it, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test-utils/render';
import OnboardingDialog from '../OnboardingDialog';
import { getLocalUserSettings, updateLocalUserSettings } from '@/services/local-settings-service';
import { localEncryption } from '@/services/local-crypto';
import { isBusinessModeEnabled, resolveFeatureSelection } from '@/lib/life-situations';

beforeEach(() => {
  localStorage.clear();
  localEncryption.lock();
});

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

    expect(await screen.findByRole('switch', { name: /Schulden/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: /Trading/ })).not.toBeChecked();
  });

  it('sollte gewählte Umstände in der Vorauswahl berücksichtigen', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText('Welche Situation beschreibt dich am ehesten?');

    await user.click(screen.getByRole('radio', { name: /Schulden abbauen/ }));
    await user.click(screen.getByRole('checkbox', { name: /Ich lege Geld an/ }));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(await screen.findByRole('switch', { name: /Trading/ })).toBeChecked();
  });

  it('sollte die bestätigte Auswahl samt abgeleiteter Einstellungen speichern', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText('Welche Situation beschreibt dich am ehesten?');

    await user.click(screen.getByRole('radio', { name: /Selbstständig oder freiberuflich/ }));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    await user.click(await screen.findByRole('button', { name: "Los geht's" }));

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
    await user.click(await screen.findByRole('switch', { name: /Trading/ }));
    await user.click(screen.getByRole('button', { name: "Los geht's" }));

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
