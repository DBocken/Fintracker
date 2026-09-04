/**
 * Coach in der fokussierten Dichte — geprüft werden die REGELN aus
 * `docs/architecture/darstellungsdichte.md` Regel 9, nicht nur dass etwas
 * rendert.
 *
 * Zwei der drei Maße sind hier prüfbar: „höchstens drei Aussagen" über die
 * Zahl der Abschnitte und „keine Boxen" über das Fehlen von Karten-Chrome.
 * Das dritte, „ein Bildschirm ohne Scrollen", ist es NICHT — jsdom hat keine
 * Höhe. Es gehört an das Gerät bzw. in die Playwright-Suite; die ADR hält
 * genau das unter „Folgen für die Wächter" fest.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import type { CoachViewModel } from '../../../application/coach-overview-view-model';
import CoachFokussiert from '../CoachFokussiert';

// Die Bausteine des Detailschritts holen ihre Daten selbst. Für diese Fläche
// sind sie Beifang — gemockt, damit der Test die Staffelung prüft.
vi.mock('../../shared/CategorySuggestionsInbox', () => ({ default: () => null }));
vi.mock('../../shared/UpcomingChargesList', () => ({ default: () => <div data-testid="charges" /> }));
vi.mock('../../shared/FoundationLadder', () => ({ default: () => <div data-testid="ladder" /> }));

const FOCUS = {
  id: 'prioritise-debt',
  title: 'Schulden zuerst tilgen',
  message: 'Mit der Lawinen-Strategie bist du am schnellsten schuldenfrei.',
  reason: 'Zinsen kosten mehr als jede Sparzinsen einbringt.',
  severity: 'warning' as const,
  ctaLabel: 'Schulden ansehen',
  ctaTo: '/debts',
};

const FOLLOW_UP = {
  id: 'check-contracts',
  title: 'Verträge prüfen',
  message: 'Drei Verträge laufen doppelt.',
  reason: 'Doppelte Verträge sind der leichteste Sparbetrag.',
  severity: 'info' as const,
  ctaLabel: 'Verträge ansehen',
  ctaTo: '/contracts',
};

const DISPOSABLE = {
  operatingCash: 1620,
  disposable: 1240,
  obligations: 380,
  obligationCount: 4,
  daysUntilPayday: 12,
  fillPercent: 24,
  health: 'ok' as const,
  warnThreshold: 80,
  paydayISO: '2026-09-16',
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
    accountsBalance: 2806.66,
    disposable: DISPOSABLE,
    disposableLoading: false,
    focus: FOCUS,
    followUps: [FOLLOW_UP],
    hasDebt: true,
    ...overrides,
  };
}

function renderFokussiert(model: CoachViewModel = modelWith()) {
  return renderWithProviders(<CoachFokussiert model={model} />, { router: true, query: true });
}

describe('Coach — fokussierte Dichte', () => {
  it('[MOBILE] sollte genau drei Aussagen tragen', () => {
    const { container } = renderFokussiert();

    // Der Seitenname ist eine Überschrift, keine Aussage; der Detail-Verweis
    // ist Rahmen. Gezählt werden die Abschnitte.
    expect(container.querySelectorAll('section')).toHaveLength(3);
  });

  it('[MOBILE] sollte keine Boxen benutzen', () => {
    const { container } = renderFokussiert();

    // Karten-Chrome heisst Rahmen + Hintergrund + Schatten. Geprüft wird das
    // Zusammentreffen von Rundung und Rahmen/Schatten — eine Haarlinie
    // (`border-t`) ist ausdrücklich erlaubt und faellt nicht darunter.
    const verdaechtig = Array.from(container.querySelectorAll<HTMLElement>('div, section, article')).filter(
      (el) => /\brounded-(?:lg|xl|2xl|3xl)\b/.test(el.className) && /\b(?:border|shadow)\b/.test(el.className),
    );

    expect(verdaechtig.map((el) => el.className)).toEqual([]);
  });

  it('[MOBILE] sollte den Kontostand als erste und grösste Zahl zeigen', () => {
    // Die Reihenfolge ist die Aussage: Danach wird beim Öffnen zuerst
    // gesucht, und alles darunter setzt diese Zahl voraus.
    const { container } = renderFokussiert();

    const saldo = screen.getByText(/2\.806,66/);
    expect(saldo).toBeInTheDocument();

    // Grösser gesetzt als der freie Betrag darunter — sonst ist „zuerst" nur
    // eine Position, keine Rangfolge.
    expect(saldo.className).toContain('text-5xl');
    expect(screen.getByText(/1\.240/).className).toContain('text-3xl');

    // Der ganze Block führt zu den Buchungen.
    const zuBuchungen = container.querySelector('a[href="/transactions"]');
    expect(zuBuchungen).not.toBeNull();
    expect(zuBuchungen?.textContent).toContain('2.806,66');
  });

  it('[MOBILE] sollte den nächsten Schritt in wenigen Zeilen zeigen', () => {
    renderFokussiert();

    expect(screen.getByRole('heading', { name: 'Schulden zuerst tilgen', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Schulden ansehen/ })).toHaveAttribute('href', '/debts');
    // Die Begruendung gehoert NICHT auf die Flaeche — sie ist die vierte
    // Aussage, die Regel 9 verhindert.
    expect(screen.queryByText(/Zinsen kosten mehr/)).toBeNull();
  });

  it('[MOBILE] sollte den freien Betrag als Zahl zeigen, mit Tagen und Fixkosten', () => {
    renderFokussiert();

    expect(screen.getByText(/1\.240/)).toBeInTheDocument();
    expect(screen.getByText(/380/)).toBeInTheDocument();
  });

  it('[MOBILE] sollte ohne offene Pflichten nicht dieselbe Zahl zweimal zeigen', () => {
    // Ohne Abbuchungen IST der freie Betrag der Kontostand. Ihn ein zweites
    // Mal zu setzen sagt nichts — die Aussage ist dann, dass nichts abgeht.
    renderFokussiert(modelWith({ disposable: { ...DISPOSABLE, obligations: 0, disposable: 2806.66 } }));

    expect(screen.getByText('Keine festen Abbuchungen mehr bis zum Gehalt')).toBeInTheDocument();
    // Der Betrag steht genau einmal auf der Fläche: als Kontostand.
    expect(screen.getAllByText(/2\.806,66/)).toHaveLength(1);
  });

  it('[MOBILE] sollte „nicht bestimmbar" von „null Euro" unterscheiden', () => {
    // Ohne erkannten Geldeingang gibt es kein „bis zum Gehalt". Eine 0 wäre
    // eine falsche Auskunft statt einer fehlenden.
    renderFokussiert(modelWith({ disposable: null }));

    expect(screen.getByText('Noch kein regelmäßiger Geldeingang erkannt.')).toBeInTheDocument();
    expect(screen.queryByText(/^0\s/)).toBeNull();
  });

  it('[MOBILE] sollte alles Übrige erst hinter dem Detailschritt zeigen', async () => {
    const user = userEvent.setup();
    renderFokussiert();

    // Vorher: nicht auf dem Bildschirm.
    expect(screen.queryByTestId('ladder')).toBeNull();
    expect(screen.queryByText('Verträge prüfen')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Mehr zu deiner Lage/ }));

    // Nachher: erreichbar. Nichts ist amputiert (ADR Regel 2).
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('ladder')).toBeInTheDocument();
    expect(within(dialog).getByText('Verträge prüfen')).toBeInTheDocument();
  });

  it('[MOBILE] sollte den Ruhezustand benennen, wenn nichts ansteht', () => {
    renderFokussiert(modelWith({ focus: undefined, followUps: [] }));

    expect(screen.getByRole('heading', { name: 'Alles im grünen Bereich', level: 2 })).toBeInTheDocument();
  });

  it('[MOBILE] sollte die Fläche übersetzen (en)', () => {
    renderWithProviders(<CoachFokussiert model={modelWith()} />, {
      router: true,
      query: true,
      locale: 'en',
    });

    expect(screen.getByText('Your next step')).toBeInTheDocument();
  });
});
