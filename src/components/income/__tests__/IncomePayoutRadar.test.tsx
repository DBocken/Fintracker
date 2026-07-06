import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import IncomePayoutRadar from '../IncomePayoutRadar';
import type { IncomeStream } from '@/lib/income-streams';

function renderWithI18n(component: React.ReactElement, locale: 'de' | 'en' = 'de') {
  return render(<I18nProvider initialLocale={locale}>{component}</I18nProvider>);
}

function stream(overrides: Partial<IncomeStream>): IncomeStream {
  return {
    key: 'k', label: 'Strom', counterparty: 'strom', mainCategoryId: null, mainCategoryName: '',
    isSalary: false, cadence: 'regelmaessig', monthlyAverage: 100, totalInWindow: 100,
    lastDateISO: '2999-11-01', lastAmount: 100, monthsActive: 6, trend: 'flat', confidence: 0.9,
    share: 0.5, transactionCount: 6, nextDateISO: '2999-12-20', nextAmount: 100, monthlyTotals: {},
    ...overrides,
  };
}

describe('IncomePayoutRadar', () => {
  it('zeigt vorhersagbare Auszahlungen sortiert nach Datum', () => {
    const { container } = renderWithI18n(
      <IncomePayoutRadar
        streams={[
          stream({ key: 'a', label: 'AdSense', nextDateISO: '2999-12-28' }),
          stream({ key: 'b', label: 'Patreon', nextDateISO: '2999-12-05' }),
        ]}
      />,
    );
    const items = within(container).getAllByRole('listitem');
    expect(items[0].textContent).toContain('Patreon');
    expect(items[1].textContent).toContain('AdSense');
  });

  it('zeigt Konfidenz-Labels bilingual', () => {
    renderWithI18n(<IncomePayoutRadar streams={[stream({ confidence: 0.95 })]} />, 'de');
    expect(screen.getByText(/Sicher/)).toBeInTheDocument();

    renderWithI18n(<IncomePayoutRadar streams={[stream({ confidence: 0.95 })]} />, 'en');
    expect(screen.getByText(/Certain/)).toBeInTheDocument();
  });

  it('zeigt einen Empty-State ohne vorhersagbare Auszahlungen', () => {
    renderWithI18n(<IncomePayoutRadar streams={[stream({ nextDateISO: null, nextAmount: null })]} />);
    expect(screen.getByText(/Noch keine vorhersagbaren Auszahlungen/)).toBeInTheDocument();
  });

  it('[REGRESSION] blendet unregelmäßige Ströme ohne Prognose aus', () => {
    const { container } = renderWithI18n(
      <IncomePayoutRadar
        streams={[
          stream({ key: 'a', label: 'Gehalt', nextDateISO: '2999-12-01' }),
          stream({ key: 'b', label: 'eBay', nextDateISO: null, nextAmount: null }),
        ]}
      />,
    );
    expect(within(container).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('eBay')).not.toBeInTheDocument();
  });
});
