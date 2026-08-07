/**
 * Migration der Buchungsseite auf die AAA+-Produktsprache.
 *
 * Der Befund dahinter ist derselbe wie bei der Atmosphäre in der AppShell:
 * die Bausteine existieren seit Phase 3, der Screen benutzt sie nur nicht.
 * `FinanceEmptyState` hat seit WP-3.3 vier Varianten — repoweit wurde an
 * fünf Stellen die Standardvariante gerendert. `Skeleton` hat seit WP-3.4
 * eine `shimmer`-Variante, die nirgends verwendet wurde.
 *
 * Geprüft wird deshalb die VERDRAHTUNG, nicht das Verhalten der Bausteine
 * (das decken FinanceEmptyState.test.tsx und skeleton.test.tsx ab).
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { I18nProvider } from '@/i18n/I18nProvider';
import type { Account, Category, Transaction } from '@/types';

const CATS: Category[] = [{ id: 'food', name: 'Lebensmittel', parent_id: null } as Category];
const ACCOUNTS: Account[] = [
  { id: 'giro', name: 'Girokonto', color: '#3b82f6', icon: '🏦', is_budget_pool_member: true, opening_balance: 0 } as Account,
];

// Der Ladezustand wird über dieses Flag gesteuert; `useQuery` liest es bei
// jedem Aufruf neu, damit ein Test ihn setzen kann, bevor er rendert.
const state = { loading: false, txs: [] as Transaction[] };

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const key = queryKey[0];
    if (key === 'transactions') return { data: state.txs, isLoading: state.loading };
    if (key === 'categories') return { data: CATS };
    if (key === 'accounts') return { data: ACCOUNTS };
    if (key === 'contract-decisions') return { data: new Map() };
    return { data: undefined };
  },
}));

vi.mock('@/components/providers/GentleModeProvider', () => ({ useGentleMode: () => ({ enabled: false }) }));
vi.mock('@/hooks/usePersistedSet', () => ({ usePersistedSet: () => [new Set(), vi.fn()] }));
vi.mock('@/hooks/useTransactionDetailEditing', () => ({
  useTransactionDetailEditing: () => ({ save: vi.fn(), isPending: false }),
}));
vi.mock('@/components/dashboard/TransactionDetailsModal', () => ({ TransactionDetailsModal: () => null }));
vi.mock('@/components/transactions/TransactionFormDialog', () => ({ TransactionFormDialog: () => null }));
vi.mock('@/services/demo-data-service', () => ({ loadDemoData: vi.fn() }));

import TransactionsPage from '../TransactionsPage';

function renderPage(locale: 'de' | 'en' = 'de') {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter initialEntries={['/transactions']}>
        <TransactionsPage />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('TransactionsPage — AAA+-Produktsprache', () => {
  describe('Leerzustand', () => {
    it('[REGRESSION] sollte die buchungsspezifische Variante zeigen, nicht den Standardtext', () => {
      state.loading = false;
      state.txs = [];
      renderPage();
      // Standardvariante saegte "Noch keine Transaktionen" — der Screen weiss
      // aber genau, WAS fehlt, und sagt es auch.
      expect(screen.getByRole('heading', { name: 'Noch keine Buchungen' })).toBeInTheDocument();
    });

    it('sollte den buchungsspezifischen Leerzustand auch auf Englisch zeigen', () => {
      state.loading = false;
      state.txs = [];
      renderPage('en');
      // Geprueft wird die BESCHREIBUNG, nicht die Ueberschrift: im Englischen
      // heissen `title` und `noTransactionsTitle` beide 'No transactions yet'.
      // Eine Pruefung der Ueberschrift bestuende auch mit der falschen Variante
      // — genau die Art Schein-Assertion, die dieser Branch an anderer Stelle
      // abgeraeumt hat.
      expect(
        screen.getByText('Import a CSV from your bank to see and analyze your transactions.'),
      ).toBeInTheDocument();
    });

    it('[ZUSTAND /transactions:leer] sollte im Leerzustand eine konkrete naechste Aktion anbieten', () => {
      state.loading = false;
      state.txs = [];
      renderPage();
      expect(screen.getByRole('link', { name: /CSV importieren/ })).toBeInTheDocument();
    });
  });

  describe('Ladezustand', () => {
    it('[REGRESSION] sollte die shimmer-Variante des Skeletons verwenden', () => {
      state.loading = true;
      state.txs = [];
      const { container } = renderPage();
      const skeletons = container.querySelectorAll('[data-variant]');
      expect(skeletons.length).toBeGreaterThan(0);
      // WP-3.4 baute die Liquid-Loading-Welle; der Screen rendert sonst den
      // klassischen Pulse-Skeleton und die Arbeit bleibt unsichtbar.
      for (const s of skeletons) {
        expect(s.getAttribute('data-variant')).toBe('shimmer');
      }
    });

    it('sollte im Ladezustand weder Leerzustand noch Liste zeigen', () => {
      state.loading = true;
      state.txs = [];
      renderPage();
      expect(screen.queryByRole('heading', { name: 'Noch keine Buchungen' })).toBeNull();
    });
  });
});
