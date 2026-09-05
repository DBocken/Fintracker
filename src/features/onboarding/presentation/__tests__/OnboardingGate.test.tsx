import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { ANONYMOUS_MODE_KEY } from '@/lib/anonymous-mode';
import type { UserSettings } from '@/types';
import OnboardingGate from '../OnboardingGate';

type AuthStatusWert = 'loading' | 'authenticated' | 'unauthenticated';
const authStatus = vi.fn<() => AuthStatusWert>(() => 'unauthenticated');
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ identity: null, status: authStatus() }),
}));

const getUserSettings = vi.fn();
vi.mock('@/services/user-settings-service', () => ({
  getUserSettings: () => getUserSettings(),
}));

function renderGate(initial = '/coach') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider initialLocale="de">
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>
            <Route path="/willkommen" element={<div>Einstieg</div>} />
            <Route
              path="/coach"
              element={
                <OnboardingGate>
                  <div>App</div>
                </OnboardingGate>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

const settings = (overrides: Partial<UserSettings>) =>
  ({
    user_id: 'local',
    auto_confirm_mapping: false,
    retention_months: 24,
    enable_subcategories: false,
    ...overrides,
  }) as UserSettings;

describe('OnboardingGate', () => {
  beforeEach(() => {
    window.localStorage.clear();
    authStatus.mockReturnValue('unauthenticated');
    getUserSettings.mockReset();
  });

  it('sollte einen Erstbesucher in den Einstieg schicken', async () => {
    getUserSettings.mockResolvedValue(settings({}));
    renderGate();
    expect(await screen.findByText('Einstieg')).toBeInTheDocument();
  });

  it('[REGRESSION] sollte einen Bestandsnutzer NICHT in den Einstieg schicken', async () => {
    // Wer die abgelösten Dialoge schon gesehen hat, trägt eine Antwort — auch
    // die übersprungene (`null`). Er darf den Fluss nie wieder sehen.
    window.localStorage.setItem(ANONYMOUS_MODE_KEY, 'true');
    getUserSettings.mockResolvedValue(settings({ onboarding_life_situation: null }));
    renderGate();
    expect(await screen.findByText('App')).toBeInTheDocument();
  });

  it('sollte einen anonym gestarteten Nutzer ohne Lebenssituation in den Einstieg schicken', async () => {
    window.localStorage.setItem(ANONYMOUS_MODE_KEY, 'true');
    getUserSettings.mockResolvedValue(settings({}));
    renderGate();
    expect(await screen.findByText('Einstieg')).toBeInTheDocument();
  });

  it('sollte einen Lesefehler NICHT als „neuer Nutzer" deuten', async () => {
    // Sonst wäre die zweite falsche Auskunft nach der ersten: Die Fläche
    // würde behaupten, der Nutzer sei neu. Der Fehlerzustand gehört dahinter.
    window.localStorage.setItem(ANONYMOUS_MODE_KEY, 'true');
    getUserSettings.mockRejectedValue(new Error('IndexedDB kaputt'));
    renderGate();
    await waitFor(() => expect(screen.getByText('App')).toBeInTheDocument());
  });
});
