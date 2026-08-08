/**
 * Route-Level-Fehlergrenze in der App-Shell (RES-7 / WP 1.6).
 *
 * Vorher gab es nur den globalen `<ErrorBoundary>` in main.tsx: ein
 * Render-Crash EINER Fläche riss die komplette App mit sich, inklusive
 * SideNav/BottomNav. `withErrorBoundary` (`ErrorBoundary.tsx`) hatte bis
 * hierher keinen Aufrufer (KOMP-6) — dieser Test beweist, dass er jetzt
 * genau das verhindert: Die Navigation bleibt sichtbar UND bedienbar, ein
 * Wechsel auf eine andere (gesunde) Route erholt sich, statt an der alten
 * Fallback-UI hängen zu bleiben.
 *
 * Die schweren Kinder der Shell sind bewusst gemockt (wie in
 * AppShell.atmosphere.test.tsx) — geprüft wird die Fehlergrenze um
 * `<Outlet />`, nicht der Aufbau der Navigation selbst.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import type { AtmosphereState } from '@/hooks/useAtmosphereState';

const atmosphereMock = vi.fn<() => AtmosphereState>(() => ({
  temperature: 'neutral',
  intensity: 0,
  pulse: 'steady',
}));
vi.mock('@/hooks/useGlobalAtmosphere', () => ({
  useGlobalAtmosphere: () => atmosphereMock(),
}));

// Factories bewusst inline: vi.mock wird an den Dateianfang gehoisted.
vi.mock('@/components/layout/SideNav', () => ({
  default: () => (
    <nav data-testid="side-nav">
      <Link to="/ok">zur OK-Seite</Link>
    </nav>
  ),
}));
vi.mock('@/components/layout/MobileNav', () => ({ default: () => <div /> }));
vi.mock('@/components/layout/BottomNav', () => ({
  default: () => <div data-testid="bottom-nav" />,
}));
vi.mock('@/components/CommandPalette', () => ({ default: () => <div /> }));
vi.mock('@/components/onboarding/DataSourceDialog', () => ({ default: () => <div /> }));
vi.mock('@/components/tutorial/TutorialHost', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/onboarding/OnboardingDialog', () => ({ default: () => <div /> }));
vi.mock('@/components/ThemeToggle', () => ({ default: () => <div /> }));
vi.mock('@/components/LanguageSwitcher', () => ({ default: () => <div /> }));
vi.mock('@/components/PrivacyIndicator', () => ({ default: () => <div /> }));
vi.mock('@/components/DemoDataBanner', () => ({ default: () => <div /> }));
vi.mock('@/components/NotificationsBell', () => ({ default: () => <div /> }));
vi.mock('@/components/UserQuickProfile', () => ({ default: () => <div /> }));

import AppShell from '../AppShell';

function Bomb(): never {
  throw new Error('Kaboom aus einer Flaeche');
}

function renderCrashingRoute(initialPath = '/boom') {
  return render(
    <I18nProvider initialLocale="de">
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/boom" element={<Bomb />} />
            <Route path="/ok" element={<div data-testid="ok-page">Alles gut</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  atmosphereMock.mockReturnValue({ temperature: 'neutral', intensity: 0, pulse: 'steady' });
  // React loggt gefangene Render-Fehler laut auf console.error — im Test stumm.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('AppShell — Route-Level-Fehlergrenze', () => {
  it('[REGRESSION] sollte bei einem Render-Crash einer Flaeche die Navigation stehen lassen statt die ganze App lahmzulegen', () => {
    renderCrashingRoute();

    // Die Fehlergrenze faengt den Absturz ab...
    expect(screen.getByText(/Etwas ist schiefgelaufen/i)).toBeInTheDocument();
    // ...UND die AppShell-Navigation ist weiterhin da.
    expect(screen.getByTestId('side-nav')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument();
  });

  it('[REGRESSION] sollte sich nach einem Wechsel auf eine gesunde Route erholen statt die alte Fallback-UI weiterzuzeigen', async () => {
    const user = userEvent.setup();
    renderCrashingRoute();

    expect(screen.getByText(/Etwas ist schiefgelaufen/i)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /zur OK-Seite/i }));

    expect(await screen.findByTestId('ok-page')).toBeInTheDocument();
    expect(screen.queryByText(/Etwas ist schiefgelaufen/i)).not.toBeInTheDocument();
    // Navigation bleibt auch nach der Erholung nutzbar.
    expect(screen.getByTestId('side-nav')).toBeInTheDocument();
  });
});
