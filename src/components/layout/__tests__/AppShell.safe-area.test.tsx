/**
 * Wächter gegen die App-Chrome unter dem Kamera-Ausschnitt.
 *
 * `android/variables.gradle` setzt `targetSdkVersion = 36`. Seit Android 15
 * (SDK 35) erzwingt das System für solche Apps **Edge-to-Edge**: Die WebView
 * zeichnet unter Statusleiste und Ausschnitt, und `sticky top-0` beginnt damit
 * nicht am sichtbaren Rand, sondern am Bildschirmrand.
 *
 * Nachgemessen war die Einrückung nur an drei Stellen gesetzt — `main`,
 * `BottomNav`, `MobileNav` — und alle drei nur UNTEN. Oben stand nichts, also
 * lief der Kopf mit Titel und Bedienelementen unter die Uhr. Der Grund, warum
 * nie etwas rot wurde: `env(safe-area-inset-*)` ist in jedem Testbrowser und
 * auf jedem Desktop 0, und die Klasse fehlt dort folgenlos. Geprüft wird
 * deshalb die **Anweisung**, nicht ihre gerechnete Wirkung.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';

vi.mock('@/hooks/useGlobalAtmosphere', () => ({
  useGlobalAtmosphere: () => ({ temperature: 'neutral', intensity: 0, pulse: 'steady' }),
}));

// Die schweren Kinder der Shell sind gemockt: geprüft wird die Einrückung des
// Rahmens, nicht der Aufbau der Navigation.
vi.mock('@/components/layout/SideNav', () => ({ default: () => <div /> }));
vi.mock('@/components/layout/MobileNav', () => ({ default: () => <div /> }));
vi.mock('@/components/layout/BottomNav', () => ({ default: () => <div /> }));
vi.mock('@/components/CommandPalette', () => ({ default: () => <div /> }));
vi.mock('@/components/onboarding/DataSourceDialog', () => ({ default: () => <div /> }));
// `TutorialHost` umschliesst die GANZE Shell — ein Mock ohne `children` würde
// Kopf und Inhalt mit entfernen und den Test grün-durch-Abwesenheit machen.
vi.mock('@/components/tutorial/TutorialHost', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/onboarding/OnboardingDialog', () => ({ default: () => <div /> }));
vi.mock('@/components/ThemeToggle', () => ({ default: () => <div /> }));
vi.mock('@/components/LanguageSwitcher', () => ({ default: () => <div /> }));
vi.mock('@/components/PrivacyIndicator', () => ({ default: () => <div /> }));
vi.mock('@/components/DemoDataBanner', () => ({ default: () => <div /> }));
vi.mock('@/components/NotificationsBell', () => ({ default: () => <div /> }));
vi.mock('@/components/UserQuickProfile', () => ({ default: () => <div /> }));
vi.mock('@/features/tutorials/presentation/TutorialLauncher', () => ({ default: () => <div /> }));

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

describe('App-Shell — Safe-Area bei Edge-to-Edge', () => {
  it('[MOBILE] sollte den Kopf unter der Statusleiste hervorholen', () => {
    renderShell();

    const header = screen.getByRole('banner');
    expect(header.className).toContain('pt-[env(safe-area-inset-top)]');
  });

  it('[MOBILE] sollte Kopf und Inhalt auch seitlich am Ausschnitt vorbeiführen', () => {
    // Im Querformat liegt der Ausschnitt an einer Schmalseite. Die App ist
    // nicht auf Hochformat festgelegt (kein `screenOrientation` im Manifest),
    // also ist das kein hypothetischer Fall.
    renderShell();

    const header = screen.getByRole('banner');
    expect(header.className).toContain('pl-[env(safe-area-inset-left)]');
    expect(header.className).toContain('pr-[env(safe-area-inset-right)]');

    const main = screen.getByRole('main');
    expect(main.className).toContain('pl-[env(safe-area-inset-left)]');
    expect(main.className).toContain('pr-[env(safe-area-inset-right)]');
  });

  it('[MOBILE] sollte den Inhalt weiterhin über der Bodennavigation enden lassen', () => {
    // Gegenprobe: Die untere Einrückung war schon da und darf beim Ergänzen
    // der oberen nicht verloren gehen — sie hält den Inhalt über der
    // Bodennavigation.
    renderShell();

    const main = screen.getByRole('main');
    expect(main.className).toContain('pb-[calc(5rem+env(safe-area-inset-bottom))]');
  });
});
