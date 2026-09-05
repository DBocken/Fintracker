/**
 * Die Auswertungen in der fokussierten Dichte — geprüft werden die REGELN aus
 * `docs/architecture/darstellungsdichte.md`, nicht dass etwas rendert.
 *
 * Zwei der drei Masse sind hier prüfbar: „keine Boxen" über das Fehlen von
 * Karten-Chrome und „eine Aussage" über die Zahl der gleichzeitig gemounteten
 * Visualisierungen. Das dritte, „ein Bildschirm ohne Scrollen", ist es NICHT —
 * jsdom hat keine Höhe. Es gehört an das Gerät bzw. in die Playwright-Messung.
 *
 * Die Vorgängerfassung (`DashboardMobileStory`) stapelte kartenumwickelte
 * Bausteine: allein `AdvancedBalanceChart` und `SankeyChart` bringen elf
 * `<Card>` mit, dazu sechs umrandete Registerkacheln und zwei berandete
 * Verweis-Chips. Die Tests hier halten fest, was davon bewusst weg ist.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import AuswertungenFokussiert from '../AuswertungenFokussiert';
import type { FinanceOverviewViewModel } from '../../../application/finance-overview-view-model';

// Recharts misst seinen Container; in jsdom ist der 0 breit. Für die Fragen
// dieser Datei — welche Rahmen, wie viele Ansichten — ist das Diagramm Beifang.
vi.mock('recharts', async () => {
  const echt = await vi.importActual<Record<string, unknown>>('recharts');
  return { ...echt, ResponsiveContainer: () => <div data-testid="diagramm" /> };
});

const HAUPTKATEGORIEN = [
  { id: 'wohnen', name: 'Wohnen', amount: 3213, byAccount: {} },
  { id: 'essen', name: 'Lebensmittel', amount: 800, byAccount: {} },
  { id: 'mobil', name: 'Mobilität', amount: 400, byAccount: {} },
  { id: 'freizeit', name: 'Freizeit', amount: 300, byAccount: {} },
  { id: 'gesundheit', name: 'Gesundheit', amount: 200, byAccount: {} },
  { id: 'kleidung', name: 'Kleidung', amount: 60, byAccount: {} },
  { id: 'spenden', name: 'Spenden', amount: 30, byAccount: {} },
  { id: 'sonstiges', name: 'Sonstiges', amount: 8, byAccount: {} },
];

function modelWith(overrides: Record<string, unknown> = {}): FinanceOverviewViewModel {
  return {
    loading: false,
    isEmpty: false,
    hasError: false,
    accountsLoading: false,
    accountsError: false,
    transactions: { all: [], visible: [], sorted: [], preview: [] },
    categories: [],
    accounts: [{ id: 'giro', name: 'Girokonto' }],
    balances: { byAccount: { giro: { amount: 2806.66, source: 'local' } }, total: 2806.66 },
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
      sunburst: { inner: [], outer: [], total: 5011 },
      sunburstTree: { roots: [] },
    },
    sankeyData: {
      // BEWUSST verschieden von `stats.income` (7818): Nur so kann ein Test
      // zeigen, AUS WELCHER Rechnung die Fläche ihre Einnahmen nimmt.
      totalIncome: 9999,
      accounts: [],
      mainCategories: HAUPTKATEGORIEN,
      subCategories: [],
    },
    filters: { values: {}, set: {}, periodOptions: [], activeCount: 0, reset: () => {} },
    ...overrides,
  } as unknown as FinanceOverviewViewModel;
}

function rendere(pfad = '/auswertungen', locale: 'de' | 'en' = 'de') {
  return renderWithProviders(<AuswertungenFokussiert model={modelWith()} />, {
    router: true,
    query: true,
    locale,
    initialEntries: [pfad],
  });
}

describe('Auswertungen — fokussierte Dichte', () => {
  it('[MOBILE] sollte keine Boxen benutzen', () => {
    const { container } = rendere();

    // Karten-Chrome heisst Rundung ZUSAMMEN mit Rahmen oder Schatten. Eine
    // Haarlinie (`border-t`) ist ausdrücklich erlaubt, ein Balken mit
    // `rounded-full` ohne Rahmen ebenso — er ist die Visualisierung selbst.
    const verdaechtig = Array.from(
      container.querySelectorAll<HTMLElement>('div, section, article'),
    ).filter(
      (el) =>
        /\brounded-(?:lg|xl|2xl|3xl)\b/.test(el.className) &&
        /\b(?:border|shadow)\b/.test(el.className),
    );

    expect(verdaechtig.map((el) => el.className)).toEqual([]);
  });

  it('[REGRESSION] [MOBILE] sollte die Registerleiste ohne Kacheln bauen', () => {
    // Sechs umrandete Kacheln waren sechs Rahmen für EINE Entscheidung.
    rendere();

    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).not.toMatch(/\bborder\b/);
      expect(tab.className).not.toMatch(/\brounded-/);
    }
  });

  it('[MOBILE] sollte genau eine Ansicht gleichzeitig zeigen', () => {
    // Regel 6: Was nicht gezeigt wird, ist nicht gemountet — und Regel 9a: die
    // Visualisierung IST die eine Aussage.
    rendere();

    expect(screen.getAllByTestId('diagramm')).toHaveLength(1);
    // Der Fluss der anderen Ansicht darf nicht mitrendern.
    expect(screen.queryByText('Wohnen')).toBeNull();
  });

  it('[REGRESSION] [MOBILE] sollte keinen zweiten Weg zu Coach und Meilensteinen anbieten', () => {
    // Beide Ziele stehen in der Bodennavigation; die berandeten Verweis-Chips
    // darunter waren ein zweiter Weg zum selben Ort.
    const { container } = rendere();

    expect(container.querySelector('a[href="/coach"]')).toBeNull();
    expect(container.querySelector('a[href="/milestones"]')).toBeNull();
  });

  it('[MOBILE] sollte eine Ansicht über die Adresse öffnen', () => {
    rendere('/auswertungen?view=fluss');

    expect(screen.getByRole('tab', { name: 'Fluss' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Wohnen')).toBeInTheDocument();
  });

  it('sollte eine unbekannte Ansicht auf den Verlauf zurückfallen lassen', () => {
    // Eine geteilte Adresse überlebt eine Umbenennung nicht — sie darf aber
    // auch nicht in eine leere Fläche führen.
    rendere('/auswertungen?view=gibtesnicht');

    expect(screen.getByRole('tab', { name: 'Verlauf' })).toHaveAttribute('aria-selected', 'true');
  });

  it('[REGRESSION] [MOBILE] sollte jede Zeitreihe beschriften und beziffern', async () => {
    // Am Gerät aufgenommen: Der Verlauf war ein blaues Dreieck, die Ausgaben
    // waren drei türkise Balken — ohne Titel, ohne Achse, ohne Zahl.
    // `ChartFigure` trägt seine `caption` ausschliesslich in der Tabelle für
    // Hilfstechnik, sichtbar stand nichts. Regel 9a („eine Visualisierung IST
    // eine Aussage") setzt voraus, dass man sie lesen kann.
    const user = userEvent.setup();
    rendere();

    // `getAllByText`, weil `ChartFigure` daneben eine `sr-only`-Zusammenfassung
    // mit denselben Zahlen ausgibt — die ist gewollt (WP-6.10) und nicht der
    // Gegenstand dieser Pruefung. Gefragt ist die SICHTBARE Kopfzeile.
    expect(screen.getByText('Entwicklung des Saldos')).toBeInTheDocument();
    // Letzter aufgelaufener Saldo: 900 + 1000 + 907 = 2807.
    expect(
      screen.getAllByText(/2\.807/).some((el) => el.className.includes('text-3xl')),
    ).toBe(true);

    await user.click(screen.getByRole('tab', { name: 'Ausgaben' }));

    expect(screen.getByText('Ausgaben je Monat')).toBeInTheDocument();
    // Letzter Monat der Reihe — und der Hinweis daneben sagt, WELCHER.
    expect(
      screen.getAllByText(/1\.711/).some((el) => el.className.includes('text-3xl')),
    ).toBe(true);
    expect(screen.getByText('2026-01')).toBeInTheDocument();
  });

  it('[MOBILE] sollte beim Blättern die Ansicht wechseln', async () => {
    const user = userEvent.setup();
    rendere();

    await user.click(screen.getByRole('tab', { name: 'Konten' }));

    expect(screen.getByText('Girokonto')).toBeInTheDocument();
    expect(screen.queryByTestId('diagramm')).toBeNull();
  });
});

/**
 * Der Fluss ohne Sankey.
 *
 * Das Sankey erzwingt auf 360 px waagerechtes Scrollen und legt seine
 * Knotenbeschriftungen übereinander. Die Aussage — rein, wohin, was bleibt —
 * braucht das nicht.
 */
describe('Auswertungen — der Fluss', () => {
  it('[MOBILE] sollte Einnahmen, Posten und Rest nennen', () => {
    rendere('/auswertungen?view=fluss');

    expect(screen.getByText('Einnahmen')).toBeInTheDocument();
    expect(screen.getByText(/7\.818/)).toBeInTheDocument();
    // 7818 − 5011 = 2807, der Rest.
    expect(screen.getByText(/2\.807/)).toBeInTheDocument();
  });

  it('[REGRESSION] [MOBILE] sollte Einnahmen und Rest aus DERSELBEN Rechnung nehmen', () => {
    // `sankeyData.totalIncome` liegt daneben (es zaehlt Einkommens-Korrekturen
    // anders). Beide Zahlen aus zwei Quellen zu ziehen ergaebe ein „Bleibt",
    // das dem Saldo der Uebersicht widerspricht — zwei Wahrheiten auf zwei
    // Flaechen.
    rendere('/auswertungen?view=fluss');

    expect(screen.queryByText(/9\.999/)).toBeNull();
  });

  it('[REGRESSION] [MOBILE] sollte übrige Posten SUMMIEREN statt abzuschneiden', () => {
    // Eine gekappte Liste sähe aus wie ein Bestand — dieselbe Lehre wie bei
    // `check:transaction-limits`. Acht Posten, sechs sichtbar; die beiden
    // übrigen sind Spenden (30) und Sonstiges (8), zusammen 38.
    rendere('/auswertungen?view=fluss');

    expect(screen.getByText('2 weitere Kategorien')).toBeInTheDocument();
    expect(screen.getByText(/38,00/)).toBeInTheDocument();
    expect(screen.queryByText('Spenden')).toBeNull();
  });

  it('[MOBILE] sollte die übrigen Posten im Detailschritt vollständig zeigen', async () => {
    const user = userEvent.setup();
    rendere('/auswertungen?view=fluss');

    await user.click(screen.getByRole('button', { name: /2 weitere Kategorien/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Spenden')).toBeInTheDocument();
    expect(within(dialog).getByText('Sonstiges')).toBeInTheDocument();
  });

  it('sollte jeden Posten zu seinen Buchungen führen', () => {
    // Regel 10 ohne Karte: Die Zeile IST die Aktion. Geprueft wird die
    // erzeugte Adresse, nicht die Kategorie-ID im Klartext: Der Parameter
    // heisst `cat` und traegt die Menge als Komma-Liste.
    const { container } = rendere('/auswertungen?view=fluss');

    expect(container.querySelector('a[href*="cat=wohnen"]')).not.toBeNull();
  });

  it('sollte die Fläche übersetzen (en)', () => {
    rendere('/auswertungen?view=fluss', 'en');

    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Left over')).toBeInTheDocument();
  });
});
