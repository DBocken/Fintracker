/**
 * Der Seitenname steht EINMAL, und zwar im Inhalt.
 *
 * Die Bildprüfung bei 360 px hat ihn doppelt gefunden: abgeschnitten in der
 * App-Leiste („Ei…", „A…", „V…") und noch einmal als Überschrift darunter.
 * Neben Menü, Suche, Schild, Glocke und Konto-Knopf blieb der Leiste die
 * Breite von zwei Zeichen — das ist kein Name, das ist Platzverbrauch.
 *
 * Geprüft wird die ANWEISUNG, nicht ihre gerechnete Wirkung: `fokussiert:` und
 * `kompakt:` sind Tailwind-Varianten am `data-density`-Attribut, und in jsdom
 * gibt es kein Stylesheet, das sie auflöst. Dieselbe Begründung wie bei den
 * Safe-Area-Tests nebenan.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import PageHeader from '@/features/shared/presentation/PageHeader';
import { SeitennameProvider } from '@/features/shared/presentation/SeitennameContext';

vi.mock('@/hooks/useGlobalAtmosphere', () => ({
  useGlobalAtmosphere: () => ({ temperature: 'neutral', intensity: 0, pulse: 'steady' }),
}));
vi.mock('@/components/layout/SideNav', () => ({ default: () => <div /> }));
vi.mock('@/components/layout/MobileNav', () => ({ default: () => <div /> }));
vi.mock('@/components/layout/BottomNav', () => ({ default: () => <div /> }));
vi.mock('@/components/CommandPalette', () => ({ default: () => <div /> }));
vi.mock('@/components/onboarding/DataSourceDialog', () => ({ default: () => <div /> }));
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

function renderShell(route: string) {
  return render(
    <I18nProvider initialLocale="de">
      <MemoryRouter initialEntries={[route]}>
        <AppShell />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('App-Shell — der Seitenname', () => {
  it('[MOBILE] sollte den Namen in der Leiste nur noch in kompakt zeigen', () => {
    renderShell('/dashboard');

    const leiste = screen.getByRole('banner');
    const titel = Array.from(leiste.querySelectorAll('div')).find((el) =>
      el.className.includes('truncate'),
    );

    expect(titel).toBeDefined();
    // In fokussiert weg, in kompakt da — eine Anweisung, beide Richtungen.
    expect(titel?.className).toContain('hidden');
    expect(titel?.className).toContain('kompakt:block');
  });

  it('[MOBILE] sollte den Namen im Inhalt tragen, und nur in fokussiert', () => {
    renderShell('/dashboard');

    const ueberschrift = screen.getByRole('heading', { level: 1 });
    expect(ueberschrift).toHaveTextContent('Dashboard');
    expect(ueberschrift.className).toContain('kompakt:hidden');
    // Sie steht im Inhalt, nicht im Kopf — sonst wäre nichts gewonnen.
    expect(screen.getByRole('main').contains(ueberschrift)).toBe(true);
  });

  it('[REGRESSION] [MOBILE] sollte die LANGFORM zeigen, nicht die Kurzform der Navigation', () => {
    // Der Befund: Navigationslabels sind breitenbegrenzt und deshalb bewusst
    // gekürzt — „Verfügbar" statt „Verfügbares Geld", „Unterm Strich" statt
    // „Besitz minus Schulden". Sie zentral als Überschrift zu rendern hätte
    // drei Seitennamen verschlechtert, statt sie zu retten.
    renderShell('/liquidity');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Verfügbares Geld');
  });

  it('sollte für eine Route ohne Navigationseintrag keinen Namen erfinden', () => {
    // `shell.appName` als Überschrift wäre eine falsche Auskunft: Die Fläche
    // heisst nicht wie die App. Dort bleibt die Fläche selbst zuständig.
    renderShell('/billing');

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });
});

describe('PageHeader — weicht der Shell, wenn sie den Namen trägt', () => {
  it('[MOBILE] sollte die eigene Überschrift in fokussiert zurücknehmen', () => {
    render(
      <I18nProvider initialLocale="de">
        <SeitennameProvider traegtDieShell>
          <PageHeader title="Buchungen" description="Alle Bewegungen" />
        </SeitennameProvider>
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { level: 1 }).className).toContain('fokussiert:hidden');
    // Beschreibung bleibt: Sie gehört der Fläche, nicht dem Rahmen.
    expect(screen.getByText('Alle Bewegungen')).toBeInTheDocument();
  });

  it('sollte die Überschrift behalten, wenn die Shell keine rendert', () => {
    render(
      <I18nProvider initialLocale="de">
        <SeitennameProvider traegtDieShell={false}>
          <PageHeader title="Abrechnung" />
        </SeitennameProvider>
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { level: 1 }).className).not.toContain('fokussiert:hidden');
  });

  it('sollte ohne Provider die Überschrift behalten', () => {
    // Voreinstellung des Kontexts ist `false`. Eine Fläche, die ausserhalb der
    // Shell gerendert wird (Test, Vor-Login-Route), verliert ihren Namen nicht.
    render(
      <I18nProvider initialLocale="de">
        <PageHeader title="Datenschutz" />
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { level: 1 }).className).not.toContain('fokussiert:hidden');
  });
});
