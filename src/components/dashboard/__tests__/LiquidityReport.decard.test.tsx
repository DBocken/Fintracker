import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { MonthlyOverviewTable } from '../LiquidityReport';
import type { ForecastMonthlySummary } from '@/lib/forecast-types';

function renderWithI18n(component: React.ReactElement) {
  return render(<I18nProvider initialLocale="de">{component}</I18nProvider>);
}

/** Karten-Chrome = sichtbarer Rahmen (`border`-Breiten-Utility) oder Schatten.
 * Hintergrund-Tönung/`divide-*` zum Bündeln zählt NICHT als Karte. */
function hasCardChrome(el: Element): boolean {
  const tokens = el.className.split(/\s+/);
  const hasBorderUtil = tokens.some((c) => /^border(-(x|y|t|r|b|l|s|e))?$/.test(c));
  const hasShadow = tokens.some((c) => /^shadow(-|$)/.test(c));
  return hasBorderUtil || hasShadow;
}

const month = (over: Partial<ForecastMonthlySummary> = {}): ForecastMonthlySummary => ({
  month: '2026-07',
  openingBalance: 1000,
  income: 2597,
  fixedExpenses: 0,
  variableExpenses: 1468,
  transfersIn: 0,
  transfersOut: 0,
  events: 0,
  interest: 0,
  closingBalance: 1802,
  lowestBalance: 1802,
  lowestBalanceDate: '2026-07-31',
  belowSafetyBuffer: false,
  ...over,
});

describe('MonthlyOverviewTable (kompakte Monatsübersicht, Prinzip 8)', () => {
  it('sollte eine Zeile je Monat mit den Kennzahlen als Tabelle rendern', () => {
    renderWithI18n(
      <MonthlyOverviewTable
        months={[month(), month({ month: '2026-08', closingBalance: 2830 })]}
      />,
    );
    // Genau eine Tabelle, ein Header + zwei Datenzeilen.
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(screen.getByText('Juli 2026')).toBeInTheDocument();
    expect(screen.getByText('Aug. 2026')).toBeInTheDocument();
    // Spaltenköpfe vorhanden.
    expect(screen.getByRole('columnheader', { name: 'Monatsende' })).toBeInTheDocument();
  });

  it('[REGRESSION] sollte EIN gebündelter Block ohne Karten-Chrome sein (kein Kachel-Raster)', () => {
    const { container } = renderWithI18n(<MonthlyOverviewTable months={[month()]} />);
    expect(hasCardChrome(container.firstElementChild as HTMLElement)).toBe(false);
    // Keine klickbare Affordanz – reines Readout.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('[REGRESSION] sollte "unter Puffer" ohne Rahmen (Tönung + Badge) signalisieren', () => {
    renderWithI18n(<MonthlyOverviewTable months={[month({ belowSafetyBuffer: true })]} />);
    expect(screen.getByText('unter Puffer')).toBeInTheDocument();
  });

  it('sollte optionale Spalten (Sparen/Transfer, Zinsen) nur bei Bedarf zeigen', () => {
    const { rerender } = renderWithI18n(<MonthlyOverviewTable months={[month()]} />);
    expect(screen.queryByRole('columnheader', { name: 'Sparen/Transfer' })).not.toBeInTheDocument();
    rerender(
      <I18nProvider initialLocale="de">
        <MonthlyOverviewTable months={[month({ transfersOut: 200, interest: 5 })]} />
      </I18nProvider>,
    );
    expect(screen.getByRole('columnheader', { name: 'Sparen/Transfer' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Zinsen' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('+5 €')).toBeInTheDocument();
  });
});
