import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import type { IncomeStream } from '@/lib/income-streams';
import type { ForecastInput } from '@/lib/forecast-types';

beforeAll(() => {
  globalThis.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const input: ForecastInput = {
  accounts: [{ id: 'giro', name: 'Girokonto', kind: 'checking', openingBalance: 1000 }],
  recurringFlows: [
    { id: 'salary:muster', name: 'Muster GmbH', amount: 3000, cadence: 'monthly', anchorDate: '2026-01-01', accountId: 'giro' },
    { id: 'rent', name: 'Miete', amount: -1200, cadence: 'monthly', anchorDate: '2026-01-01', accountId: 'giro' },
  ],
  variableExpenses: [{ category: 'Lebensmittel', monthlyAmount: 300 }],
};

vi.mock('@/hooks/useForecast', () => ({
  useForecast: () => ({ input, forecast: null, analysis: null, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
}));
vi.mock('@/hooks/useForecastOverrides', () => ({
  useForecastOverrides: () => ({ overrides: { months: 6, safetyBuffer: 500, bufferBasis: 'operating' } }),
}));

import IncomeStressTestDialog from '../IncomeStressTestDialog';
import IncomeStressTestSection from '../IncomeStressTestSection';

function stream(overrides: Partial<IncomeStream>): IncomeStream {
  return {
    key: 'anstellung|muster', label: 'Muster GmbH', counterparty: 'muster', mainCategoryId: 'anstellung',
    mainCategoryName: 'Anstellung', isSalary: true, cadence: 'regelmaessig', monthlyAverage: 3000,
    totalInWindow: 36000, lastDateISO: '2024-12-01', lastAmount: 3000, monthsActive: 12, trend: 'flat',
    confidence: 0.95, share: 0.9, transactionCount: 12, nextDateISO: null, nextAmount: null, monthlyTotals: {},
    payments: [],
    ...overrides,
  };
}

describe('IncomeStressTestDialog', () => {
  it('zeigt die Szenario-Kennzahlen für einen prognostizierten Strom', () => {
    renderWithProviders(<IncomeStressTestDialog stream={stream({})} open onOpenChange={() => {}} />);
    expect(screen.getByText('Tiefster Kontostand')).toBeInTheDocument();
    expect(screen.getByText('Tage unter Sicherheitspuffer')).toBeInTheDocument();
  });

  it('[REGRESSION] zeigt bei fehlendem Flow-Match einen Hinweis statt 0-Kennzahlen', () => {
    renderWithProviders(<IncomeStressTestDialog stream={stream({ counterparty: 'nichtinprognose', key: 'x' })} open onOpenChange={() => {}} />);
    expect(screen.getByText(/nicht Teil der Vorausschau/)).toBeInTheDocument();
    expect(screen.queryByText('Tiefster Kontostand')).not.toBeInTheDocument();
  });

  it('zeigt die Kennzahlen englisch', () => {
    renderWithProviders(<IncomeStressTestDialog stream={stream({})} open onOpenChange={() => {}} />, { locale: 'en' });
    expect(screen.getByText('Lowest balance')).toBeInTheDocument();
  });
});

describe('IncomeStressTestSection', () => {
  it('blendet Mini-Ströme unter 3 % aus', () => {
    renderWithProviders(
      <IncomeStressTestSection
        streams={[stream({ key: 'big', label: 'Groß', share: 0.5 }), stream({ key: 'tiny', label: 'Winzig', share: 0.01 })]}
      />,
    );
    expect(screen.getByText('Groß')).toBeInTheDocument();
    expect(screen.queryByText('Winzig')).not.toBeInTheDocument();
  });

  it('rendert nichts, wenn kein Strom relevant ist', () => {
    const { container } = renderWithProviders(<IncomeStressTestSection streams={[stream({ share: 0.01 })]} />);
    expect(container.textContent).toBe('');
  });
});
