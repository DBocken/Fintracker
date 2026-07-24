import { describe, expect, it, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test-utils/render';
import NavFeatureSettings from '../NavFeatureSettings';
import { getLocalUserSettings, updateLocalUserSettings } from '@/services/local-settings-service';
import { localEncryption } from '@/services/local-crypto';
import { NAV_FEATURE_PATHS, type NavFeatureId } from '@/lib/archetypes';

const ALL = Object.keys(NAV_FEATURE_PATHS) as NavFeatureId[];

beforeEach(() => {
  localStorage.clear();
  localEncryption.lock();
});

function renderSettings(locale: 'de' | 'en' = 'de') {
  return renderWithProviders(<NavFeatureSettings />, { locale, query: true });
}

describe('NavFeatureSettings', () => {
  it('sollte erklären, dass Ausgeblendetes erreichbar bleibt', async () => {
    renderSettings();
    expect(
      await screen.findByText(/bleibt über Links und Lesezeichen erreichbar/),
    ).toBeInTheDocument();
  });

  it('sollte ohne getroffene Auswahl alle Bereiche als aktiv zeigen', async () => {
    renderSettings();
    const switches = await screen.findAllByRole('switch');
    expect(switches).toHaveLength(ALL.length);
    for (const toggle of switches) {
      expect(toggle).toBeChecked();
    }
  });

  it('sollte die gewählte Situation benennen', async () => {
    await updateLocalUserSettings({ onboarding_archetype: 'retired' });
    renderSettings();
    expect(await screen.findByText(/Gewählte Situation — Ruhestand/)).toBeInTheDocument();
  });

  it('sollte eine Änderung sofort speichern', async () => {
    const user = userEvent.setup();
    await updateLocalUserSettings({ enabled_nav_features: ['budgets'] });
    renderSettings();

    await user.click(await screen.findByRole('switch', { name: /Trading/ }));

    await waitFor(async () => {
      const settings = await getLocalUserSettings();
      expect(settings.enabled_nav_features).toEqual(expect.arrayContaining(['budgets', 'trading']));
    });
  });

  it('sollte einen Bereich wieder ausblenden können', async () => {
    const user = userEvent.setup();
    await updateLocalUserSettings({ enabled_nav_features: ['budgets', 'trading'] });
    renderSettings();

    await user.click(await screen.findByRole('switch', { name: /Trading/ }));

    await waitFor(async () => {
      const settings = await getLocalUserSettings();
      expect(settings.enabled_nav_features).toEqual(['budgets']);
    });
  });

  it('sollte per „Alle Bereiche anzeigen" die Einschränkung aufheben', async () => {
    const user = userEvent.setup();
    await updateLocalUserSettings({ enabled_nav_features: ['budgets'] });
    renderSettings();

    await user.click(await screen.findByRole('button', { name: 'Alle Bereiche anzeigen' }));

    await waitFor(async () => {
      const settings = await getLocalUserSettings();
      expect(settings.enabled_nav_features).toBeNull();
    });
  });

  it('sollte das Onboarding erneut anbieten können', async () => {
    const user = userEvent.setup();
    await updateLocalUserSettings({ onboarding_archetype: 'family' });
    renderSettings();

    await user.click(await screen.findByRole('button', { name: 'Situation neu wählen' }));

    await waitFor(async () => {
      const settings = await getLocalUserSettings();
      expect(settings.onboarding_archetype).toBeUndefined();
    });
  });

  it('sollte englische Texte rendern', async () => {
    renderSettings('en');
    expect(await screen.findByText('Areas & navigation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all areas' })).toBeInTheDocument();
  });
});
