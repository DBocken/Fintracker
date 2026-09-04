/**
 * Mobile Coach-Fläche: eine Hauptaussage, alles Übrige gestaffelt.
 *
 * Geprüft wird gegen ein von Hand gebautes ViewModel statt gegen die Seite —
 * die Präsentation ist reine Darstellung und hat keine eigenen Abfragen, und
 * genau das soll der Test auch zusichern können, ohne sechs Services zu
 * mocken. Die Fläche als Ganzes (Lade-/Leer-/Fehlerzustand) prüfen weiterhin
 * `CoachPage.states.test.tsx` und `CoachPage.error-state.test.tsx`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import type { CoachViewModel } from '../../../application/coach-overview-view-model';
import CoachMobileToday from '../CoachMobileToday';

// Die Kinder der Register holen ihre Daten selbst (Kochrezept Schritt 8 ist
// fuer sie noch offen). Fuer diese Fläche sind sie Beifang — gemockt, damit
// der Test die Staffelung prüft und nicht sechs Services.
vi.mock('../../shared/DisposableTankCard', () => ({
  default: () => <div data-testid="tank" />,
}));
vi.mock('../../shared/UpcomingChargesList', () => ({
  default: () => <div data-testid="charges" />,
}));
vi.mock('../../shared/FoundationLadder', () => ({
  default: () => <div data-testid="ladder" />,
}));
vi.mock('../../shared/CategorySuggestionsInbox', () => ({
  default: () => null,
}));

const FOCUS = {
  id: 'build-starter-fund',
  title: 'Notgroschen aufbauen',
  message: 'Lege 1.000 € als Puffer zurück.',
  reason: 'Ohne Puffer wird jede Panne zur Schuld.',
  severity: 'warning' as const,
  ctaLabel: 'Zum Dashboard',
  ctaTo: '/dashboard',
};

const FOLLOW_UP = {
  id: 'reduce-subscriptions',
  title: 'Abos prüfen',
  message: 'Drei Verträge laufen doppelt.',
  reason: 'Doppelte Verträge sind der leichteste Sparbetrag.',
  severity: 'info' as const,
  ctaLabel: 'Verträge ansehen',
  ctaTo: '/contracts',
};

function modelWith(overrides: Partial<CoachViewModel> = {}): CoachViewModel {
  return {
    loading: false,
    isEmpty: false,
    hasError: false,
    retry: () => {},
    coach: undefined,
    health: undefined,
    milestones: undefined,
    milestonesLoading: false,
    focus: FOCUS,
    followUps: [FOLLOW_UP],
    hasDebt: false,
    ...overrides,
  };
}

describe('Mobile Coach-Fläche', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[MOBILE] sollte genau EINE Empfehlung als Hauptaussage zeigen und die übrigen wegstaffeln', () => {
    renderWithProviders(<CoachMobileToday model={modelWith()} />, { router: true, query: true });

    // Der priorisierte Schritt steht im ersten Bildschirm …
    expect(screen.getByText('Notgroschen aufbauen')).toBeInTheDocument();
    // … die Folgeempfehlung NICHT: sie liegt im Register „Mehr". Genau das
    // unterscheidet die Fläche vom Desktop-Stapel — ohne diese Zusicherung
    // wäre „mobil" wieder nur „schmaler".
    expect(screen.queryByText('Abos prüfen')).toBeNull();
  });

  it('[MOBILE] sollte alle vier Register mit einem Trefferbereich von mindestens 44 px anbieten', () => {
    renderWithProviders(<CoachMobileToday model={modelWith()} />, { router: true, query: true });

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    for (const tab of tabs) {
      // Die Tap-Fläche ist grösser als das 16-px-Icon darin (AGENTS.md §4).
      expect(tab.className).toContain('min-h-[44px]');
    }
  });

  it('[MOBILE] sollte beim Registerwechsel den Inhalt tauschen statt zu scrollen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CoachMobileToday model={modelWith()} />, { router: true, query: true });

    // Startregister „Status": kein Tank, keine Folgeempfehlung.
    expect(screen.queryByTestId('tank')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Geld' }));
    expect(screen.getByTestId('tank')).toBeInTheDocument();
    expect(screen.getByTestId('charges')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Mehr' }));
    expect(screen.queryByTestId('tank')).toBeNull();
    // Nichts ist amputiert: die Folgeempfehlung ist erreichbar, nur später.
    expect(screen.getByText('Abos prüfen')).toBeInTheDocument();
  });

  it('[MOBILE] sollte das aktive Register auch für Screenreader auszeichnen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CoachMobileToday model={modelWith()} />, { router: true, query: true });

    const status = screen.getByRole('tab', { name: 'Status' });
    const goals = screen.getByRole('tab', { name: 'Ziele' });
    expect(status).toHaveAttribute('aria-selected', 'true');
    expect(goals).toHaveAttribute('aria-selected', 'false');

    await user.click(goals);
    expect(goals).toHaveAttribute('aria-selected', 'true');
    expect(status).toHaveAttribute('aria-selected', 'false');
  });

  it('[MOBILE] sollte ohne Empfehlung den Ruhezustand benennen statt eine leere Fläche zu zeigen', () => {
    renderWithProviders(
      <CoachMobileToday model={modelWith({ focus: undefined, followUps: [] })} />,
      { router: true, query: true },
    );

    expect(screen.getByText('Alles im grünen Bereich')).toBeInTheDocument();
  });

  it('[MOBILE] sollte die Registerbeschriftungen übersetzen (en)', () => {
    renderWithProviders(<CoachMobileToday model={modelWith()} />, { router: true, query: true, locale: 'en' });

    const tablist = screen.getByRole('tablist');
    expect(within(tablist).getByRole('tab', { name: 'Money' })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: 'Goals' })).toBeInTheDocument();
  });
});
