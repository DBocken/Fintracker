import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import BusinessModeSettings from '../BusinessModeSettings';
import { getLocalUserSettings } from '@/services/local-settings-service';
import { localEncryption } from '@/services/local-crypto';

function renderSettings(locale: 'de' | 'en' = 'de') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider initialLocale={locale}>
        <BusinessModeSettings />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localEncryption.lock();
  localStorage.setItem('ausgabentracker_locale_v1', 'de');
});

describe('BusinessModeSettings', () => {
  it('sollte deutsche Texte rendern', () => {
    renderSettings('de');
    expect(screen.getByText('Einzelunternehmer-Modus')).toBeInTheDocument();
  });

  it('sollte englische Texte rendern', () => {
    renderSettings('en');
    expect(screen.getByText('Sole-proprietor mode')).toBeInTheDocument();
  });

  it('sollte den Modus per Switch persistieren (Opt-in, Default aus)', async () => {
    renderSettings();

    const toggle = await screen.findByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);

    await waitFor(async () => {
      expect((await getLocalUserSettings()).business_mode).toBe(true);
    });
  });

  it('sollte den Modus wieder deaktivieren können', async () => {
    renderSettings();
    const toggle = await screen.findByRole('switch');

    fireEvent.click(toggle);
    await waitFor(async () => expect((await getLocalUserSettings()).business_mode).toBe(true));
    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true'));

    fireEvent.click(screen.getByRole('switch'));
    await waitFor(async () => expect((await getLocalUserSettings()).business_mode).toBe(false));
  });
});
