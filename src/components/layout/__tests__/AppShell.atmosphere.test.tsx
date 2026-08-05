/**
 * Wächter gegen die fest verdrahtete Atmosphäre in der App-Shell.
 *
 * Der Fehler, den dieser Test verhindert, war NICHT im Hook: `deriveAtmosphere`
 * und `useAtmosphereState` waren korrekt und getestet. `AppShell` gab dem
 * `AtmosphereLayer` aber ein Literal
 * (`{ temperature: 'neutral', intensity: 0, pulse: 'steady' }`) statt der
 * abgeleiteten Werte — die Schicht war eingebaut und dauerhaft unsichtbar.
 * Ein Hook-Test kann das prinzipiell nicht bemerken; geprüft werden muss die
 * Verdrahtung selbst.
 *
 * Die schweren Kinder der Shell sind bewusst gemockt: geprüft wird genau eine
 * Kante (Hook -> AtmosphereLayer), nicht der Aufbau der Navigation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

// Factories bewusst inline: vi.mock wird an den Dateianfang gehoisted, eine
// gemeinsame Hilfsfunktion waere dort noch nicht initialisiert.
vi.mock('@/components/layout/SideNav', () => ({ default: () => <div /> }));
vi.mock('@/components/layout/MobileNav', () => ({ default: () => <div /> }));
vi.mock('@/components/layout/BottomNav', () => ({ default: () => <div /> }));
vi.mock('@/components/CommandPalette', () => ({ default: () => <div /> }));
vi.mock('@/components/onboarding/DataSourceDialog', () => ({ default: () => <div /> }));
vi.mock('@/components/tutorial/TutorialHost', () => ({ default: () => <div /> }));
vi.mock('@/components/onboarding/OnboardingDialog', () => ({ default: () => <div /> }));
vi.mock('@/components/ThemeToggle', () => ({ default: () => <div /> }));
vi.mock('@/components/LanguageSwitcher', () => ({ default: () => <div /> }));
vi.mock('@/components/PrivacyIndicator', () => ({ default: () => <div /> }));
vi.mock('@/components/DemoDataBanner', () => ({ default: () => <div /> }));
vi.mock('@/components/NotificationsBell', () => ({ default: () => <div /> }));
vi.mock('@/components/UserQuickProfile', () => ({ default: () => <div /> }));

import AppShell from '../AppShell';

function renderShell() {
  return render(
    <I18nProvider initialLocale="de">
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell />
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  atmosphereMock.mockReturnValue({ temperature: 'neutral', intensity: 0, pulse: 'steady' });
});

describe('AppShell — Atmosphäre-Verdrahtung', () => {
  it('[REGRESSION] sollte den abgeleiteten Zustand durchreichen statt ihn fest zu verdrahten', () => {
    atmosphereMock.mockReturnValue({ temperature: 'warm', intensity: 0.8, pulse: 'celebrate' });
    renderShell();

    const layer = screen.getByTestId('atmosphere-layer');
    expect(layer).toHaveAttribute('data-temperature', 'warm');
    // Deckkraft folgt der Intensity (MAX_OPACITY 0.08 * 0.8).
    expect(Number(layer.style.opacity)).toBeGreaterThan(0);
  });

  it('[REGRESSION] sollte auch eine kuehle Stimmung durchreichen', () => {
    atmosphereMock.mockReturnValue({ temperature: 'cool', intensity: 0.5, pulse: 'alert' });
    renderShell();

    expect(screen.getByTestId('atmosphere-layer')).toHaveAttribute('data-temperature', 'cool');
  });

  it('sollte bei neutraler Stimmung unsichtbar bleiben', () => {
    renderShell();

    const layer = screen.getByTestId('atmosphere-layer');
    expect(layer).toHaveAttribute('data-temperature', 'neutral');
    expect(Number(layer.style.opacity)).toBe(0);
  });

  it('sollte die Schicht klick-durchlaessig und fuer Screenreader unsichtbar halten', () => {
    atmosphereMock.mockReturnValue({ temperature: 'warm', intensity: 1, pulse: 'steady' });
    renderShell();

    const layer = screen.getByTestId('atmosphere-layer');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(layer.style.pointerEvents).toBe('none');
  });
});
