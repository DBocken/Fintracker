import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { renderWithProviders } from '@/test-utils/render';
import IncomeStreamList from '../IncomeStreamList';
import type { IncomeStream } from '@/lib/income-streams';

function stream(overrides: Partial<IncomeStream>): IncomeStream {
  return {
    key: 'anstellung|muster gmbh',
    label: 'Muster GmbH',
    counterparty: 'muster gmbh',
    mainCategoryId: 'anstellung',
    mainCategoryName: 'Anstellung',
    isSalary: true,
    cadence: 'regelmaessig',
    monthlyAverage: 3000,
    totalInWindow: 36000,
    lastDateISO: '2024-12-01',
    lastAmount: 3000,
    monthsActive: 12,
    trend: 'flat',
    confidence: 0.95,
    share: 0.9,
    transactionCount: 12,
    nextDateISO: null,
    nextAmount: null,
    monthlyTotals: {},
    ...overrides,
  };
}

describe('IncomeStreamList', () => {
  it('rendert eine klickbare Karte je Strom mit Deep-Link auf gefilterte Buchungen', () => {
    render(
      <I18nProvider initialLocale="de">
        <MemoryRouter>
          <IncomeStreamList streams={[stream({})]} />
        </MemoryRouter>
      </I18nProvider>,
    );
    const link = screen.getByRole('link', { name: /Muster GmbH/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('/transactions?'));
    expect(link.getAttribute('href')).toContain('cat=anstellung');
  });

  it('zeigt die Kadenz-Badges übersetzt (Deutsch)', () => {
    renderWithProviders(
      <IncomeStreamList streams={[stream({ cadence: 'regelmaessig' }), stream({ key: 'x', label: 'eBay Payments', cadence: 'unregelmaessig' })]} />,
      { locale: 'de' },
    );
    expect(screen.getByText('Regelmäßig')).toBeInTheDocument();
    expect(screen.getByText('Unregelmäßig')).toBeInTheDocument();
  });

  it('zeigt die Kadenz-Badges übersetzt (Englisch)', () => {
    renderWithProviders(
      <IncomeStreamList streams={[stream({ cadence: 'regelmaessig' }), stream({ key: 'x', label: 'eBay Payments', cadence: 'unregelmaessig' })]} />,
      { locale: 'en' },
    );
    expect(screen.getByText('Regular')).toBeInTheDocument();
    expect(screen.getByText('Irregular')).toBeInTheDocument();
  });

  it('zeigt einen Hinweis, wenn keine Ströme vorliegen', () => {
    renderWithProviders(<IncomeStreamList streams={[]} />);
    expect(screen.getByText(/Noch keine Einnahmen erfasst/i)).toBeInTheDocument();
  });

  it('zeigt "Alle anzeigen" erst ab mehr als 8 Strömen', () => {
    const many = Array.from({ length: 9 }, (_, i) => stream({ key: `s${i}`, label: `Strom ${i}` }));
    renderWithProviders(<IncomeStreamList streams={many} />);
    expect(screen.getByRole('button', { name: /Alle anzeigen/i })).toBeInTheDocument();
  });
});
