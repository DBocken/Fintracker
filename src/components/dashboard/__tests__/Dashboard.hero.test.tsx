/**
 * Hero-Hierarchie des Dashboards (WP-4.1, korrigiert 2026-08-05).
 *
 * Befund des Critic-Reviews (critic-reports/wp-4.6-art-ux-motion.md, A-1):
 * derselbe Betrag stand drei- bis viermal auf dem Screen. Der Hero zeigte den
 * ZEITRAUM-Saldo, unmittelbar darunter wiederholte TransactionStats den
 * KONTOSTAND ebenso gross — in den Demodaten dieselbe Zahl. Damit konkurrierten
 * zwei Hauptaussagen, und der Hero verlor die Dominanz, fuer die er gebaut
 * wurde.
 *
 * Entscheidung des Auftraggebers: der AKTUELLE KONTOSTAND ist die Hauptaussage.
 *
 * Die Fixture gibt `balance` und `currentBalance` bewusst UNTERSCHIEDLICHE
 * Werte. In der echten App fallen sie in den Demodaten zusammen — ein Test mit
 * gleichen Werten koennte nicht unterscheiden, welche der beiden Zahlen der
 * Hero zeigt, und bestuende auch vor der Korrektur.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

const PERIOD_BALANCE = 1234.56;
const CURRENT_BALANCE = 9876.54;

const model = {
  isEmpty: false,
  stats: {
    balance: PERIOD_BALANCE,
    currentBalance: CURRENT_BALANCE,
    income: 5000,
    expenses: 3765.44,
    count: 12,
    sunburst: { inner: [], outer: [], total: 0 },
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

// Schwere Kinder: geprueft wird genau eine Kante (Modell -> Hero), nicht der
// Aufbau des restlichen Dashboards.
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

describe('Dashboard — Hero-Hierarchie', () => {
  it('[REGRESSION] sollte den aktuellen Kontostand als Hero zeigen, nicht den Zeitraum-Saldo', () => {
    renderWithProviders(<Dashboard />, { query: true });

    const hero = screen.getByTestId('stat-hero-value');
    expect(hero.textContent).toContain('9.876,54');
    // Gegenprobe: der Zeitraum-Saldo darf NICHT im Hero stehen.
    expect(hero.textContent).not.toContain('1.234,56');
  });

  it('[REGRESSION] sollte den Kontostand nicht ein zweites Mal gross wiederholen', () => {
    renderWithProviders(<Dashboard />, { query: true });

    // Vorher rendete TransactionStats denselben Betrag direkt darunter noch
    // einmal als dominante Zahl unter der Ueberschrift "Kontostand". Genau
    // diese Doppelung ist Befund A-1 — der Block ist jetzt weg.
    // Geprueft wird zusaetzlich, dass "Kontostand" nur noch EINMAL vorkommt,
    // naemlich im Hero-Label: die Kennzahlenzeile nannte den Zeitraum-Saldo
    // in Alltagssprache ebenfalls "Kontostand" (zwei Groessen, ein Wort).
    expect(screen.queryByText('Kontostand')).toBeNull();
    // Der Betrag selbst erscheint nur noch einmal, im Hero.
    // Hinweis: Intl setzt ein schmales geschuetztes Leerzeichen vor das €,
    // deshalb wird nur auf die Ziffernfolge geprueft.
    expect(screen.getAllByText(/9\.876,54/)).toHaveLength(1);
  });

  it('sollte den Zeitraum-Saldo weiterhin als Nebenkennzahl zeigen', async () => {
    renderWithProviders(<Dashboard />, { query: true });

    // Er verschwindet nicht — er tritt nur zurueck in die Kennzahlenzeile,
    // die auf ganze Euro rundet (1234,56 -> "+1.235 €").
    //
    // `findByText` statt `getByText` seit WP-6.9: die Kennzahlen zaehlen auf
    // ihren Wert hoch, statt ihn zu setzen. Der Endwert steht also erst nach
    // dem Tween da — genau die sichtbare Aussage des Arbeitspakets.
    expect(await screen.findByText(/1\.235/)).toBeInTheDocument();
  });

  it('sollte den Hero mit dem Kontostand-Label beschriften', () => {
    renderWithProviders(<Dashboard />, { query: true });
    expect(screen.getByText('Aktueller Kontostand')).toBeInTheDocument();
  });
});
