/**
 * Befunde A-2 und A-3 aus dem WP-4.6-Critic-Review
 * (critic-reports/wp-4.6-art-ux-motion.md).
 *
 * A-2: Drei Hinweisebenen (Tutorial-Einladung, Demodaten-Banner, Coach-
 * Streifen) standen übereinander VOR dem Inhalt. Regel jetzt: höchstens eine
 * ECHTE Hinweisebene gleichzeitig — der Coach-Streifen wartet, bis die
 * Tutorial-Einladung weggeklickt oder abgeschlossen ist. Der Demodaten-Banner
 * ist bewusst ausgenommen: Datenherkunft ist Integritätsanzeige, keine
 * aufschiebbare Meta-Kommunikation.
 *
 * A-3: Der Stadt-Einstieg war ein fast leerer Kartenstreifen in Hero-Nähe.
 * Jetzt trägt er eine Vorschau: Stimmungsfarbe + eine Kennzahl (Viertel).
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { TutorialPresenceProvider } from '@/components/tutorial/tutorial-presence';

const model = {
  isEmpty: false,
  stats: {
    balance: 1234.56,
    currentBalance: 9876.54,
    income: 5000,
    expenses: 3765.44,
    count: 12,
    sunburst: {
      inner: [],
      outer: [
        { id: 'wohnen', name: 'Wohnen', value: 980 },
        { id: 'lebensmittel', name: 'Lebensmittel', value: 450 },
        { id: 'mobilitaet', name: 'Mobilität', value: 120 },
      ],
      total: 1550,
    },
  },
  transactions: { all: [], preview: [], sorted: [], visible: [] },
  accounts: [],
  categories: [],
  hidden: { ids: new Set<string>(), toggle: vi.fn() },
  sort: { config: null, toggle: vi.fn() },
  filters: {
    activeCount: 0,
    periodOptions: [],
    reset: vi.fn(),
    transactionsLink: '/transactions',
    set: {},
    values: { range: 'all', search: '', category: 'all', account: 'all' },
  },
  actions: {
    deleteTransaction: vi.fn(),
    saveDetails: vi.fn(),
    updateCategory: vi.fn(),
    reload: vi.fn(),
    detailsSaving: false,
  },
};

vi.mock('@/features/dashboard/application/use-finance-overview', () => ({
  useFinanceOverview: () => model,
}));

// Schwere Kinder: geprueft werden die Karten oben, nicht das restliche Dashboard.
vi.mock('@/features/dashboard/presentation/desktop/DashboardDesktopView', () => ({
  DashboardDesktopView: () => <div />,
}));
vi.mock('@/features/dashboard/presentation/mobile/DashboardMobileStory', () => ({ default: () => <div /> }));
vi.mock('../AnalysisModePanel', () => ({ default: () => <div /> }));
vi.mock('@/components/kpi/KpiSection', () => ({ KpiSection: () => <div /> }));
vi.mock('../TransactionTable', () => ({ TransactionTable: () => <div /> }));
vi.mock('../TransactionListMobile', () => ({ TransactionListMobile: () => <div /> }));
vi.mock('../TransactionDetailsModal', () => ({ TransactionDetailsModal: () => null }));
vi.mock('../TransactionFilters', () => ({ TransactionFilters: () => <div /> }));
vi.mock('../DeleteConfirmationDialog', () => ({ DeleteConfirmationDialog: () => null }));
vi.mock('@/components/providers/GentleModeProvider', () => ({ useGentleMode: () => ({ enabled: false }) }));

import { Dashboard } from '../Dashboard';

describe('Dashboard — Hinweisebenen (Befund A-2)', () => {
  it('[REGRESSION] sollte den Coach-Streifen zurückhalten, solange die Tutorial-Einladung sichtbar ist (Deutsch)', () => {
    renderWithProviders(
      <TutorialPresenceProvider value={{ hintVisible: true }}>
        <Dashboard />
      </TutorialPresenceProvider>,
      { query: true, locale: 'de' },
    );
    expect(screen.queryByText(/Deine nächste Aktion zeigt dir der Coach/)).not.toBeInTheDocument();
  });

  it('[REGRESSION] sollte den Coach-Streifen zurückhalten, solange die Tutorial-Einladung sichtbar ist (Englisch)', () => {
    renderWithProviders(
      <TutorialPresenceProvider value={{ hintVisible: true }}>
        <Dashboard />
      </TutorialPresenceProvider>,
      { query: true, locale: 'en' },
    );
    expect(screen.queryByText(/Your next step is shown by the coach/)).not.toBeInTheDocument();
  });

  it('sollte den Coach-Streifen zeigen, wenn keine Tutorial-Hinweisebene aktiv ist', () => {
    renderWithProviders(<Dashboard />, { query: true, locale: 'de' });
    expect(screen.getByText(/Deine nächste Aktion zeigt dir der Coach/)).toBeInTheDocument();
  });
});

describe('Dashboard — Stadt-Karte mit Vorschau (Befund A-3)', () => {
  it('[REGRESSION] sollte die Viertel-Kennzahl auf der Stadt-Karte zeigen (Deutsch)', () => {
    renderWithProviders(<Dashboard />, { query: true, locale: 'de' });
    expect(screen.getByText(/3 Viertel/)).toBeInTheDocument();
  });

  it('[REGRESSION] sollte die Viertel-Kennzahl auf der Stadt-Karte zeigen (Englisch)', () => {
    renderWithProviders(<Dashboard />, { query: true, locale: 'en' });
    expect(screen.getByText(/3 districts/)).toBeInTheDocument();
  });

  it('sollte ohne Ausgaben-Viertel die Entstehen-Zeile zeigen statt einer 0', () => {
    const outerBackup = model.stats.sunburst.outer;
    model.stats.sunburst.outer = [];
    try {
      renderWithProviders(<Dashboard />, { query: true, locale: 'de' });
      expect(screen.getByText('Deine Stadt entsteht aus deinen Buchungen')).toBeInTheDocument();
      expect(screen.queryByText(/0 Viertel/)).not.toBeInTheDocument();
    } finally {
      model.stats.sunburst.outer = outerBackup;
    }
  });
});
