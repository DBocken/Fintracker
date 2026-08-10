/**
 * zod-Grenze für die GoCardless-Kontoantwort (GOV-1 / WP 2.2).
 *
 * Vor dem Fix lief `(result.accounts || []) as unknown as GoCardlessAccount[]`
 * — ein reiner Compile-Zeit-Cast, der zur Laufzeit nichts prüft. Fremde
 * Bankdaten (Supabase Edge Function -> GoCardless) flossen ungeprüft bis in
 * den React-State. Dieser Test belegt: eine gültige Antwort geht durch, eine
 * manipulierte (fehlendes Pflichtfeld) erreicht die Fläche nie, sondern
 * landet sichtbar im Fehlerzustand.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';

const getAccountsMock = vi.fn();
const completeBankConnectionMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/services/gocardless-service', () => ({
  gocardlessService: {
    getAccounts: (...args: unknown[]) => getAccountsMock(...args),
    completeBankConnection: (...args: unknown[]) => completeBankConnectionMock(...args),
  },
}));

vi.mock('@/services/bank-connection-service', () => ({
  bankConnectionService: { getBankConnectionByRequisitionId: vi.fn() },
}));

vi.mock('@/services/account-service', () => ({
  getAccounts: vi.fn().mockResolvedValue([]),
  updateAccount: vi.fn(),
  createAccount: vi.fn(),
}));

vi.mock('@/services/gocardless-sync-service', () => ({
  syncAccountTransactions: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

import BankCallbackPage from '../BankCallbackPage';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider initialLocale="de">
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/bank-callback?ref=req-abc']}>
          <BankCallbackPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe('BankCallbackPage — GoCardless-Kontoantwort an der Datengrenze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    completeBankConnectionMock.mockResolvedValue(undefined);
  });

  it('sollte eine gültige Kontoantwort anzeigen', async () => {
    getAccountsMock.mockResolvedValue({
      requisition: { id: 'req-abc', status: 'LN' },
      accounts: [
        { id: 'acc1', currency: 'EUR', name: 'Girokonto Test', iban: 'DE89370400440532013000' },
      ],
    });

    renderPage();

    expect(await screen.findByText('Girokonto Test')).toBeInTheDocument();
  });

  it('[REGRESSION] sollte eine manipulierte Kontoantwort (ohne `currency`) NICHT rendern, sondern den Fehlerzustand zeigen', async () => {
    getAccountsMock.mockResolvedValue({
      requisition: { id: 'req-abc', status: 'LN' },
      // `currency` fehlt — eine reale Antwort hat das immer; das ist der
      // manipulierte/kaputte Fall, den der Cast bisher durchgewunken hätte.
      accounts: [{ id: 'acc1', name: 'Manipuliertes Konto' }],
    });

    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Manipuliertes Konto')).not.toBeInTheDocument();
    expect(completeBankConnectionMock).not.toHaveBeenCalled();
  });
});
