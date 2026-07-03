import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Kpi, MonthSummary } from '../LiquidityReport';
import type { ForecastMonthlySummary } from '@/lib/forecast-types';
import { TrendingDown } from 'lucide-react';

/** Karten-Chrome = sichtbarer Rahmen (`border`-Breiten-Utility) oder Schatten.
 * Hintergrund-Tönung zum Bündeln zählt NICHT als Karte (Usability-Audit). */
function hasCardChrome(el: HTMLElement): boolean {
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

describe('Liquidityreport Prinzip 8 (Karten sind Aktionen)', () => {
  describe('Kpi (Kennzahl-Readout)', () => {
    it('sollte Label, Wert und Hinweis anzeigen', () => {
      render(<Kpi icon={<TrendingDown />} label="Tiefststand" value="1.802 €" hint="31.7." />);
      expect(screen.getByText('Tiefststand')).toBeInTheDocument();
      expect(screen.getByText('1.802 €')).toBeInTheDocument();
      expect(screen.getByText('31.7.')).toBeInTheDocument();
    });

    it('[REGRESSION] sollte ohne Karten-Chrome und nicht klickbar rendern', () => {
      const { container } = render(<Kpi icon={<TrendingDown />} label="A" value="1 €" />);
      expect(hasCardChrome(container.firstElementChild as HTMLElement)).toBe(false);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('MonthSummary (Monatsübersicht-Readout)', () => {
    it('sollte Monat und Kennzahlen anzeigen', () => {
      render(<MonthSummary m={month()} />);
      expect(screen.getByText('Juli 2026')).toBeInTheDocument();
      expect(screen.getByText('Einnahmen')).toBeInTheDocument();
      expect(screen.getByText('Monatsende')).toBeInTheDocument();
    });

    it('[REGRESSION] sollte ohne Karten-Chrome und nicht klickbar rendern', () => {
      const { container } = render(<MonthSummary m={month()} previousClosingBalance={1000} />);
      expect(hasCardChrome(container.firstElementChild as HTMLElement)).toBe(false);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('[REGRESSION] sollte "unter Puffer" ohne Rahmen (nur Tönung/Badge) signalisieren', () => {
      const { container } = render(<MonthSummary m={month({ belowSafetyBuffer: true })} />);
      expect(hasCardChrome(container.firstElementChild as HTMLElement)).toBe(false);
      expect(screen.getByText('unter Puffer')).toBeInTheDocument();
    });
  });
});
