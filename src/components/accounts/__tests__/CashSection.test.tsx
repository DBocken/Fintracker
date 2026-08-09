import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import type { Account, Transaction } from '@/types';

// Radix' Select (im Kind-Dialog CashWithdrawalDialog) misst seine Breite über
// ResizeObserver, den jsdom nicht kennt.
globalThis.ResizeObserver ||= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

vi.mock('@/components/providers/GentleModeProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
  useGentleMode: () => ({ enabled: false, toggle: () => {} }),
}));

vi.mock('@/services/account-service', () => ({
  getAccounts: vi.fn(),
  createAccount: vi.fn(),
}));
vi.mock('@/services/transaction-service', () => ({
  getTransactions: vi.fn().mockResolvedValue([]),
  createTransaction: vi.fn(),
  getCategories: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/net-worth-service', () => ({
  getNetWorthBreakdown: vi.fn().mockResolvedValue({ accountBalances: {} }),
}));
vi.mock('@/services/cash-service', () => ({
  detectCashWithdrawals: vi.fn().mockReturnValue([]),
  findCashAccount: vi.fn(),
  moveWithdrawalToCash: vi.fn(),
  recordCashWithdrawal: vi.fn(),
}));

import { CashSection } from '../CashSection';
import { getAccounts, createAccount } from '@/services/account-service';
import { getTransactions } from '@/services/transaction-service';
import { detectCashWithdrawals, findCashAccount, moveWithdrawalToCash } from '@/services/cash-service';

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: 'acc-1',
    user_id: 'local',
    name: 'Konto',
    type: 'checking',
    currency: 'EUR',
    color: '#1d5c54',
    icon: '🏦',
    is_budget_pool_member: true,
    order_index: 0,
    ...overrides,
  };
}

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    date: '2026-06-10',
    amount: -50,
    payee: 'Geldautomat',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
  };
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  render(
    <I18nProvider initialLocale="de">
      <QueryClientProvider client={client}>
        <CashSection />
      </QueryClientProvider>
    </I18nProvider>,
  );
  return { invalidateSpy };
}

describe('CashSection – Query-Invalidierung (PERF-2, WP 4.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Normal Behavior', () => {
    it('[REGRESSION] sollte beim Anlegen des Bargeld-Kontos NICHT die Buchungen invalidieren (keine Buchung betroffen)', async () => {
      vi.mocked(getAccounts).mockResolvedValue([]);
      vi.mocked(findCashAccount).mockReturnValue(undefined);
      vi.mocked(createAccount).mockResolvedValue(makeAccount({ id: 'cash-1', type: 'cash', name: 'Bargeld' }));

      const { invalidateSpy } = renderSection();

      const createButton = await screen.findByRole('button', { name: /Bargeld-Konto anlegen/i });
      fireEvent.click(createButton);

      await waitFor(() => expect(createAccount).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());

      expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['transactions'] });
    });

    it('sollte beim Übernehmen einer Bargeldabhebung weiterhin die Buchungen invalidieren (frische Daten, da eine Buchung entsteht)', async () => {
      const cashAccount = makeAccount({ id: 'cash-1', type: 'cash', name: 'Bargeld' });
      const withdrawal = makeTx({ id: 'giro-tx-1' });

      vi.mocked(getAccounts).mockResolvedValue([cashAccount]);
      vi.mocked(findCashAccount).mockReturnValue(cashAccount);
      vi.mocked(getTransactions).mockResolvedValue([withdrawal]);
      vi.mocked(detectCashWithdrawals).mockReturnValue([withdrawal]);
      vi.mocked(moveWithdrawalToCash).mockResolvedValue(makeTx({ id: 'cash-credit-1' }));

      const { invalidateSpy } = renderSection();

      const acceptButton = await screen.findByRole('button', { name: /Übernehmen|akzeptieren/i });
      fireEvent.click(acceptButton);

      await waitFor(() => expect(moveWithdrawalToCash).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['transactions'] }));
    });
  });
});
