import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import type { IncomeStream } from '@/lib/income-streams';
import type { UserSettings } from '@/types';

let mockSettings: Partial<UserSettings> = { tax_reserve_percent: 30 };

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mockSettings }),
}));

import IncomeTaxReserveHint from '../IncomeTaxReserveHint';

function renderWithI18n(component: React.ReactElement, locale: 'de' | 'en' = 'de') {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter>{component}</MemoryRouter>
    </I18nProvider>,
  );
}

function stream(mainCategoryId: string | null, total: number): IncomeStream {
  return {
    key: `${mainCategoryId}|x`, label: 'X', counterparty: 'x', mainCategoryId, mainCategoryName: 'Online & Creator',
    isSalary: false, cadence: 'regelmaessig', monthlyAverage: total / 12, totalInWindow: total, lastDateISO: '2024-12-01',
    lastAmount: total / 12, monthsActive: 12, trend: 'flat', confidence: 0.9, share: 0.5, transactionCount: 12,
    nextDateISO: null, nextAmount: null, monthlyTotals: {},
  };
}

describe('IncomeTaxReserveHint', () => {
  it('zeigt Prozentsatz und Pflicht-Disclaimer bei relevantem Einkommen', () => {
    mockSettings = { tax_reserve_percent: 30 };
    renderWithI18n(<IncomeTaxReserveHint streams={[stream('local-cat-onlinecreator', 5000)]} />);
    expect(screen.getByText(/~30 %/)).toBeInTheDocument();
    expect(screen.getByText(/keine Steuerberatung/)).toBeInTheDocument();
  });

  it('zeigt den englischen Disclaimer', () => {
    mockSettings = { tax_reserve_percent: 30 };
    renderWithI18n(<IncomeTaxReserveHint streams={[stream('local-cat-onlinecreator', 5000)]} />, 'en');
    expect(screen.getByText(/not tax advice/)).toBeInTheDocument();
  });

  it('[REGRESSION] verschwindet vollständig bei 0 %', () => {
    mockSettings = { tax_reserve_percent: 0 };
    const { container } = renderWithI18n(<IncomeTaxReserveHint streams={[stream('local-cat-onlinecreator', 5000)]} />);
    expect(container.textContent).toBe('');
  });

  it('rendert nichts, wenn nur Anstellungs-Einkommen vorliegt', () => {
    mockSettings = { tax_reserve_percent: 30 };
    const { container } = renderWithI18n(<IncomeTaxReserveHint streams={[stream('local-cat-anstellung', 30000)]} />);
    expect(container.textContent).toBe('');
  });
});
