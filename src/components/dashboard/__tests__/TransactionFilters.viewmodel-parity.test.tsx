import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { renderWithI18n } from '@/test-utils/render';
import type { FilterViewModel } from '@/features/shared/domain/filter-view-model';
import type { TransactionsOverviewViewModel } from '@/features/transactions/application/transactions-overview-view-model';
import { toFilterViewModel } from '@/features/transactions/presentation/shared/filter-view-model-adapter';
import { TransactionFilters } from '../TransactionFilters';

/**
 * [REGRESSION] KOMP-2 — Dashboard-Vorschau und `/transactions` filtern
 * identisch.
 *
 * Vor WP 5.4 nahm `TransactionFilters` 25 flache Props entgegen, und die
 * identische 21-Prop-Verdrahtung stand wortgleich in `Dashboard.tsx` UND
 * `TransactionsListPane.tsx` — die Gleichheit war NUR dadurch gegeben, dass
 * jemand die Zeilen zweimal richtig abgeschrieben hatte. Ein vertauschtes
 * Feld (`filterEssential={filters.values.contract}`) wäre unbemerkt geblieben.
 *
 * Seither läuft jeder Aufrufer durch denselben `FilterViewModel`-Vertrag:
 * Dashboard reicht `model.filters` direkt durch (Feld-Setter 1:1), die
 * Buchungsseite baut ihn über `toFilterViewModel` aus dem patch-basierten
 * Setter von `useTransactionsOverview`. Dieser Test simuliert dieselbe
 * Nutzeraktion (Vertragsstatus-Filter wählen) einmal je Konstruktionsweg und
 * prüft, dass BEIDE exakt dasselbe Feld mit demselben Wert treffen — keines
 * der Nachbarfelder.
 */

function buildDashboardStyleFilters() {
  // 1:1 wie `FinanceOverviewViewModel.filters.set` (use-finance-overview.ts):
  // Feld-Setter, keine `patch`-Zwischenstufe.
  const set = {
    category: vi.fn(),
    account: vi.fn(),
    contract: vi.fn(),
    essential: vi.fn(),
    ausgabenklasse: vi.fn(),
    search: vi.fn(),
    range: vi.fn(),
    customDays: vi.fn(),
    customGranularity: vi.fn(),
    customPeriod: vi.fn(),
  };
  const filters: FilterViewModel = {
    values: {
      category: 'all',
      account: 'all',
      contract: 'all',
      essential: 'all',
      ausgabenklasse: 'all',
      search: '',
      range: 'Gesamt',
      customDays: 30,
      customGranularity: 'daily',
      customPeriod: '',
    },
    set,
    periodOptions: [],
    categories: [],
    accounts: [],
  };
  return { filters, set };
}

function buildTransactionsStyleFilters() {
  // 1:1 wie `TransactionsOverviewViewModel.filters` (use-transactions-overview.ts):
  // EIN `patch`, adaptiert über `toFilterViewModel` (dieselbe Funktion, die
  // `TransactionsListPane` produktiv verwendet).
  const patch = vi.fn();
  const rawFilters: TransactionsOverviewViewModel['filters'] = {
    values: {
      category: 'all',
      account: 'all',
      contract: 'all',
      essential: 'all',
      ausgabenklasse: 'all',
      search: '',
      range: 'Gesamt',
      customDays: 30,
      customPeriod: undefined,
    },
    customGranularity: 'daily',
    set: { patch, range: vi.fn(), customGranularity: vi.fn() },
    activeCount: 0,
    periodOptions: [],
    reset: vi.fn(),
  };
  const filters = toFilterViewModel(rawFilters, [], []);
  return { filters, patch };
}

describe('TransactionFilters – Dashboard und /transactions filtern identisch (KOMP-2)', () => {
  it('[REGRESSION] sollte die Vertragsstatus-Auswahl bei beiden Konstruktionswegen NUR den Vertrags-Filter setzen', async () => {
    const user = userEvent.setup();

    // --- Weg 1: Dashboard (direkter Durchreich von model.filters) ---
    const { filters: dashboardFilters, set: dashboardSet } = buildDashboardStyleFilters();
    const dashboardRender = renderWithI18n(
      <TransactionFilters filters={dashboardFilters} showSearch={false} />,
    );
    await user.click(screen.getByRole('combobox', { name: 'Vertragsstatus filtern' }));
    await user.click(await screen.findByRole('option', { name: 'Nur Verträge' }));

    expect(dashboardSet.contract).toHaveBeenCalledExactlyOnceWith('vertrag');
    expect(dashboardSet.essential).not.toHaveBeenCalled();
    expect(dashboardSet.category).not.toHaveBeenCalled();
    expect(dashboardSet.account).not.toHaveBeenCalled();
    dashboardRender.unmount();

    // --- Weg 2: /transactions (toFilterViewModel-Adapter über patch) ---
    const { filters: txFilters, patch } = buildTransactionsStyleFilters();
    const txRender = renderWithI18n(<TransactionFilters filters={txFilters} showSearch={false} />);
    await user.click(screen.getByRole('combobox', { name: 'Vertragsstatus filtern' }));
    await user.click(await screen.findByRole('option', { name: 'Nur Verträge' }));

    // Identisch: derselbe Wert, dasselbe (und einzige) Feld — nur der
    // Transportweg (Feld-Setter vs. patch) unterscheidet sich technisch.
    expect(patch).toHaveBeenCalledExactlyOnceWith({ contract: 'vertrag' });
    txRender.unmount();
  });

  it('[REGRESSION] sollte die Essenziell-Auswahl bei beiden Konstruktionswegen NUR den Essenziell-Filter setzen', async () => {
    const user = userEvent.setup();

    const { filters: dashboardFilters, set: dashboardSet } = buildDashboardStyleFilters();
    const dashboardRender = renderWithI18n(
      <TransactionFilters filters={dashboardFilters} showSearch={false} />,
    );
    await user.click(screen.getByRole('combobox', { name: 'Essenziell-Status filtern' }));
    await user.click(await screen.findByRole('option', { name: 'Nur essenziell' }));

    expect(dashboardSet.essential).toHaveBeenCalledExactlyOnceWith('ess');
    expect(dashboardSet.contract).not.toHaveBeenCalled();
    dashboardRender.unmount();

    const { filters: txFilters, patch } = buildTransactionsStyleFilters();
    const txRender = renderWithI18n(<TransactionFilters filters={txFilters} showSearch={false} />);
    await user.click(screen.getByRole('combobox', { name: 'Essenziell-Status filtern' }));
    await user.click(await screen.findByRole('option', { name: 'Nur essenziell' }));

    expect(patch).toHaveBeenCalledExactlyOnceWith({ essential: 'ess' });
    txRender.unmount();
  });
});
