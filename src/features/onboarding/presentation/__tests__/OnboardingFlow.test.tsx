import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import { onboardingFeatureCatalog } from '@/components/layout/nav-config';
import { ANONYMOUS_MODE_KEY } from '@/lib/anonymous-mode';
import type { UserSettings } from '@/types';
import { ONBOARDING_DRAFT_KEY } from '../../data/onboarding-draft-store';
import OnboardingFlow from '../OnboardingFlow';

vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
  useMotionSafe: (props: unknown) => props,
}));

type AuthStatusWert = 'loading' | 'authenticated' | 'unauthenticated';
const authStatus = vi.fn<() => AuthStatusWert>(() => 'unauthenticated');
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ identity: null, status: authStatus() }),
}));

const getUserSettings = vi.fn();
const updateUserSettings = vi.fn();
vi.mock('@/services/user-settings-service', () => ({
  getUserSettings: () => getUserSettings(),
  updateUserSettings: (patch: Partial<UserSettings>) => updateUserSettings(patch),
}));

const loadDemoData = vi.fn();
vi.mock('@/services/demo-data-service', () => ({
  loadDemoData: () => loadDemoData(),
  isDemoDataActive: () => false,
  DEMO_ACTIVE_KEY: 'demo',
  DEMO_ACTIVE_EVENT: 'demo',
}));

vi.mock('@supabase/auth-ui-react', () => ({ Auth: () => <div /> }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }) } },
}));

const catalog = onboardingFeatureCatalog();

function Adresse() {
  const location = useLocation();
  return <div data-testid="adresse">{location.pathname}</div>;
}

function renderFlow(initial = '/willkommen') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider initialLocale="de">
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[initial]}>
          <Adresse />
          <Routes>
            <Route path="/willkommen" element={<OnboardingFlow catalog={catalog} />} />
            <Route path="/willkommen/:step" element={<OnboardingFlow catalog={catalog} />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="/csv" element={<div>Datei-Import</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

const adresse = () => screen.getByTestId('adresse').textContent;

describe('OnboardingFlow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    authStatus.mockReturnValue('unauthenticated');
    getUserSettings.mockReset();
    getUserSettings.mockResolvedValue({ user_id: 'local' } as UserSettings);
    updateUserSettings.mockReset();
    updateUserSettings.mockResolvedValue({ user_id: 'local' } as UserSettings);
    loadDemoData.mockReset();
    loadDemoData.mockResolvedValue(undefined);
  });

  it('sollte einen Erstbesucher bei der Sprachwahl beginnen lassen', async () => {
    renderFlow();
    await waitFor(() => expect(adresse()).toBe('/willkommen/sprache'));
    expect(screen.getByText('Wähle deine Sprache')).toBeInTheDocument();
  });

  it('sollte einen zu weit gesprungenen Schritt zurückbeschneiden', async () => {
    // Die Adresse ist frei tippbar: Ohne Wegwahl gibt es keine Bereichsauswahl.
    renderFlow('/willkommen/bereiche');
    await waitFor(() => expect(adresse()).toBe('/willkommen/weg'));
  });

  it('sollte einen unbekannten Schritt auf den Wiederaufsetzpunkt lenken', async () => {
    renderFlow('/willkommen/quatsch');
    await waitFor(() => expect(adresse()).toBe('/willkommen/sprache'));
  });

  it('sollte den anonymen Weg an der Anmeldung vorbeiführen', async () => {
    const user = userEvent.setup();
    renderFlow('/willkommen/weg');
    await user.click(screen.getByRole('button', { name: /Anonym/ }));
    await waitFor(() => expect(adresse()).toBe('/willkommen/begruessung'));
    expect(window.localStorage.getItem(ANONYMOUS_MODE_KEY)).toBeTruthy();
  });

  it('sollte den Konto-Weg zur Anmeldung führen', async () => {
    const user = userEvent.setup();
    renderFlow('/willkommen/weg');
    await user.click(screen.getByRole('button', { name: /Angemeldet/ }));
    await waitFor(() => expect(adresse()).toBe('/willkommen/anmeldung'));
  });

  it('sollte nach der Rückkehr vom Anbieter hinter der Anmeldung weitermachen', async () => {
    // Der OAuth-Umweg verlässt die Seite vollständig; wiedergefunden wird der
    // Stand allein über den Entwurf im localStorage.
    authStatus.mockReturnValue('authenticated');
    window.localStorage.setItem(
      ONBOARDING_DRAFT_KEY,
      JSON.stringify({ step: 'anmeldung', path: 'account' }),
    );
    renderFlow('/willkommen');
    await waitFor(() => expect(adresse()).toBe('/willkommen/begruessung'));
  });

  it('sollte den Entwurf über ein Neuladen hinweg behalten', async () => {
    const user = userEvent.setup();
    const { unmount } = renderFlow('/willkommen/begruessung');
    // Erst den Weg setzen, damit die Begrüßung überhaupt erreichbar ist.
    unmount();
    window.localStorage.setItem(
      ONBOARDING_DRAFT_KEY,
      JSON.stringify({ step: 'begruessung', path: 'anonymous' }),
    );
    window.localStorage.setItem(ANONYMOUS_MODE_KEY, 'true');
    renderFlow('/willkommen');
    await waitFor(() => expect(adresse()).toBe('/willkommen/begruessung'));
    await user.type(screen.getByLabelText('Dein Name'), 'Dana');
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    await waitFor(() => expect(adresse()).toBe('/willkommen/situation'));
    expect(window.localStorage.getItem(ONBOARDING_DRAFT_KEY)).toContain('Dana');
  });

  it('sollte am Ende genau EINEN Schreibvorgang auslösen', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(ANONYMOUS_MODE_KEY, 'true');
    window.localStorage.setItem(
      ONBOARDING_DRAFT_KEY,
      JSON.stringify({
        step: 'start',
        path: 'anonymous',
        displayName: 'Dana',
        lifeSituation: 'employed_stable',
        modifiers: [],
      }),
    );
    renderFlow('/willkommen/start');
    await user.click(screen.getByRole('button', { name: /Beispieldaten/ }));
    await waitFor(() => screen.getByText('Möchtest du ein Tutorial starten?'));
    await user.click(screen.getByRole('button', { name: /Selbst erkunden/ }));

    await waitFor(() => expect(adresse()).toBe('/dashboard'));
    expect(loadDemoData).toHaveBeenCalledTimes(1);
    expect(updateUserSettings).toHaveBeenCalledTimes(1);
    expect(updateUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: 'Dana',
        onboarding_life_situation: 'employed_stable',
        tutorial_source: 'demo',
      }),
    );
    // Der Entwurf ist nach der Übernahme abgeräumt.
    expect(window.localStorage.getItem(ONBOARDING_DRAFT_KEY)).toBeNull();
  });

  it('[ZUSTAND /willkommen:fehler] sollte einen Lesefehler der Einstellungen benennen', async () => {
    window.localStorage.setItem(ANONYMOUS_MODE_KEY, 'true');
    window.localStorage.setItem(
      ONBOARDING_DRAFT_KEY,
      JSON.stringify({ step: 'situation', path: 'anonymous' }),
    );
    getUserSettings.mockRejectedValue(new Error('IndexedDB kaputt'));
    renderFlow('/willkommen/situation');
    expect(await screen.findByRole('alert')).toHaveTextContent(/nicht gelesen werden/);
  });

  it('sollte auf Englisch durch denselben Fluss führen', async () => {
    render(
      <I18nProvider initialLocale="en">
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter initialEntries={['/willkommen/weg']}>
            <Routes>
              <Route path="/willkommen/:step" element={<OnboardingFlow catalog={catalog} />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </I18nProvider>,
    );
    expect(await screen.findByText('You have two options.')).toBeInTheDocument();
  });
});
