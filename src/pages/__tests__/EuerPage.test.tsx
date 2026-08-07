import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import EuerPage from '../EuerPage';
import { saveTransactions } from '@/services/transaction-service';
import { transactionStorage } from '@/services/transaction-storage-service';
import { writeLocalFinanceList } from '@/services/local-finance-store';
import { localEncryption } from '@/services/local-crypto';
import type { Account, Transaction } from '@/types';

// Reduced-Motion erzwingen: Count-up/Tank zeigen den Zielzustand direkt —
// jsdom treibt requestAnimationFrame-Tweens nicht zuverlässig zu Ende.
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

// Radix' Select (Jahres-Picker) misst per ResizeObserver, den jsdom nicht kennt.
globalThis.ResizeObserver ||= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function account(id: string, isBusiness: boolean): Account {
  return {
    id,
    user_id: 'local',
    name: id,
    type: 'checking',
    currency: 'EUR',
    color: '#111',
    icon: '🏦',
    is_budget_pool_member: true,
    is_business: isBusiness,
    order_index: 0,
  };
}

let seq = 0;
function tx(overrides: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    id: `euer-page-${seq}`,
    account_id: 'biz',
    date: '2025-05-10',
    amount: -100,
    payee: 'X',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
  };
}

function renderPage(url = '/euer?year=2025', locale: 'de' | 'en' = 'de') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider initialLocale={locale}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/euer" element={<EuerPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  localStorage.clear();
  localEncryption.lock();
  localStorage.setItem('ausgabentracker_locale_v1', 'de');
  await transactionStorage.clearLocalCache();
  await writeLocalFinanceList('accounts', [account('biz', true), account('priv', false)]);
});

describe('EuerPage (Smoke)', () => {
  it('sollte Summary, Zeilen und Tank für das Jahr aus der URL rendern', async () => {
    await saveTransactions([
      tx({ amount: 5000, tax_category_id: 'tax-eur-betriebseinnahme' }),
      tx({ amount: -1000, tax_category_id: 'tax-eur-bewirtung' }),
      // Anderes Jahr — darf bei ?year=2025 nicht einfließen.
      tx({ date: '2024-05-10', amount: 99999, tax_category_id: 'tax-eur-betriebseinnahme' }),
    ]);

    renderPage('/euer?year=2025');

    // Summary: Gewinn = 5.000 − 700 = 4.300 (Bewirtung 70 %).
    expect(await screen.findByText('Gewinn')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/4\.300/)).toBeInTheDocument());
    expect(screen.queryByText(/99\.999|104\.999/)).not.toBeInTheDocument();

    // Tank ist da (Jahr aus der URL).
    expect(screen.getByText(/Steuerrücklage 2025/)).toBeInTheDocument();
  });

  it('sollte die unassignedExpenses-Warnung für unmarkierte Geschäftskonto-Ausgaben zeigen', async () => {
    await saveTransactions([tx({ amount: -80 })]);

    renderPage('/euer?year=2025');

    await waitFor(() =>
      expect(screen.getByText(/unmarkierte Ausgaben auf dem Geschäftskonto/)).toBeInTheDocument(),
    );
  });

  it('[ZUSTAND /euer:leer] sollte ohne Betriebsdaten den Leerzustand zeigen', async () => {
    renderPage('/euer?year=2025');
    expect(await screen.findByText('Noch keine Betriebsdaten')).toBeInTheDocument();
  });

  it('sollte englische Texte rendern (i18n)', async () => {
    localStorage.setItem('ausgabentracker_locale_v1', 'en');
    await saveTransactions([tx({ amount: 5000, tax_category_id: 'tax-eur-betriebseinnahme' })]);

    renderPage('/euer?year=2025', 'en');

    expect(await screen.findByText('Profit')).toBeInTheDocument();
  });
});
