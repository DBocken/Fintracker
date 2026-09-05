/**
 * Die Übersicht in der fokussierten Dichte — geprüft werden die REGELN aus
 * `docs/architecture/darstellungsdichte.md` Regel 9, nicht dass etwas rendert.
 *
 * Zwei der drei Masse sind hier prüfbar: „höchstens drei Aussagen" über die
 * Zahl der Abschnitte und „keine Boxen" über das Fehlen von Karten-Chrome. Das
 * dritte, „ein Bildschirm ohne Scrollen", ist es NICHT — jsdom hat keine Höhe.
 * Es gehört an das Gerät bzw. in die Playwright-Messung.
 *
 * Die Vorgängerfassung trug auf 360 px gemessen 3,33 Bildschirmlängen und rund
 * fünfzehn Aussagen; die Tests hier halten fest, was davon bewusst NICHT mehr
 * da ist.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import DashboardFokussiert from '../DashboardFokussiert';
import type { FinanceOverviewViewModel } from '../../../application/finance-overview-view-model';

// Recharts misst seinen Container; in jsdom ist der 0 breit. Für die Fragen
// dieser Datei — wie viele Aussagen, welche Rahmen — ist das Diagramm Beifang.
vi.mock('recharts', async () => {
  const echt = await vi.importActual<Record<string, unknown>>('recharts');
  return { ...echt, ResponsiveContainer: () => <div data-testid="diagramm" /> };
});

const SUNBURST = {
  inner: [],
  outer: [
    { id: 'wohnen', parentId: 'essenziell', name: 'Wohnen', value: 3213 },
    { id: 'essen', parentId: 'essenziell', name: 'Lebensmittel', value: 800 },
  ],
  total: 5011,
};

function modelWith(overrides: Record<string, unknown> = {}): FinanceOverviewViewModel {
  return {
    loading: false,
    isEmpty: false,
    hasError: false,
    accountsLoading: false,
    accountsError: false,
    transactions: { all: new Array(44).fill(null), visible: [], sorted: [], preview: [] },
    categories: [],
    accounts: [],
    balances: { byAccount: {}, total: 0 },
    stats: {
      income: 7818,
      expenses: 5011,
      balance: 2807,
      currentBalance: 2806.66,
      count: 44,
      series: [
        { date: '2025-11', income: 2600, expenses: 1700 },
        { date: '2025-12', income: 2600, expenses: 1600 },
        { date: '2026-01', income: 2618, expenses: 1711 },
      ],
      sunburst: SUNBURST,
      sunburstTree: { roots: [] },
    },
    filters: { values: {}, set: {}, periodOptions: [], activeCount: 0, reset: () => {} },
    ...overrides,
  } as unknown as FinanceOverviewViewModel;
}

function rendere(model: FinanceOverviewViewModel = modelWith()) {
  return renderWithProviders(<DashboardFokussiert model={model} />, { router: true, query: true });
}

describe('Übersicht — fokussierte Dichte', () => {
  it('[MOBILE] sollte genau drei Aussagen tragen', () => {
    const { container } = rendere();

    // Der Detail-Verweis ist Rahmen, keine Aussage. Gezählt werden die
    // Abschnitte: Ausgegeben, grösster Posten, Verlauf.
    expect(container.querySelectorAll('section')).toHaveLength(3);
  });

  it('[MOBILE] sollte keine Boxen benutzen', () => {
    const { container } = rendere();

    // Karten-Chrome heisst Rundung ZUSAMMEN mit Rahmen oder Schatten. Eine
    // Haarlinie (`border-t`) ist ausdrücklich erlaubt.
    const verdaechtig = Array.from(
      container.querySelectorAll<HTMLElement>('div, section, article'),
    ).filter(
      (el) =>
        /\brounded-(?:lg|xl|2xl|3xl)\b/.test(el.className) &&
        /\b(?:border|shadow)\b/.test(el.className),
    );

    expect(verdaechtig.map((el) => el.className)).toEqual([]);
  });

  it('[MOBILE] sollte das Ausgegebene als erste und grösste Zahl zeigen', () => {
    // Die Reihenfolge ist die Aussage: Die Übersicht beantwortet „wohin ist
    // mein Geld gegangen", nicht „was habe ich" — das steht auf /coach.
    const { container } = rendere();

    const betrag = screen.getByText(/5\.011/);
    expect(betrag.className).toContain('text-5xl');
    expect(container.querySelector('a[href^="/transactions"]')).not.toBeNull();
  });

  it('[REGRESSION] [MOBILE] sollte den Kontostand NICHT wiederholen', () => {
    // Er stand hier zweimal — als Hero und in der Kennzahlenreihe darunter —
    // und ein drittes Mal auf /coach. Die Übersicht zeigt ihn gar nicht mehr.
    rendere();

    expect(screen.queryByText(/2\.806,66/)).toBeNull();
  });

  it('[REGRESSION] [MOBILE] sollte keinen zweiten Weg zu Stadt und Coach anbieten', () => {
    // Beide Ziele stehen in der Bodennavigation. Eine ganze Karte für einen
    // zweiten Weg zum selben Ort sagt nichts und kostet einen halben
    // Bildschirm.
    const { container } = rendere();

    expect(container.querySelector('a[href="/city"]')).toBeNull();
    expect(container.querySelector('a[href="/coach"]')).toBeNull();
  });

  it('[MOBILE] sollte den grössten Posten mit Anteil zeigen und vertiefen lassen', () => {
    const { container } = rendere();

    expect(screen.getByText('Wohnen')).toBeInTheDocument();
    expect(screen.getByText(/64/)).toBeInTheDocument();
    expect(container.querySelector('a[href="/auswertungen?view=kategorien"]')).not.toBeNull();
  });

  it('[MOBILE] sollte den Verlauf zur Wisch-Fläche führen lassen', () => {
    // Regel 10, ohne Karte: Die Visualisierung IST die Aktion.
    const { container } = rendere();

    expect(container.querySelector('a[href="/auswertungen?view=verlauf"]')).not.toBeNull();
  });

  it('[MOBILE] sollte alles Übrige erst hinter dem Detailschritt zeigen', async () => {
    const user = userEvent.setup();
    rendere();

    expect(screen.queryByText(/7\.818/)).toBeNull();

    await user.click(screen.getByRole('button', { name: /Alles ansehen/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/7\.818/)).toBeInTheDocument();
  });

  it('sollte ohne Ausgaben nicht behaupten, es gebe einen grössten Posten', () => {
    rendere(
      modelWith({
        stats: {
          ...modelWith().stats,
          expenses: 0,
          sunburst: { inner: [], outer: [], total: 0 },
        },
      }),
    );

    expect(screen.getByText('In diesem Zeitraum keine Ausgaben')).toBeInTheDocument();
  });

  it('sollte die Fläche übersetzen (en)', () => {
    renderWithProviders(<DashboardFokussiert model={modelWith()} />, {
      router: true,
      query: true,
      locale: 'en',
    });

    expect(screen.getByText('Spent')).toBeInTheDocument();
  });
});
