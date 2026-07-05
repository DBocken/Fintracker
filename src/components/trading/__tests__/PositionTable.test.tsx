import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { translations } from '@/i18n/translations';
import type { PortfolioPosition } from '@/types';
import PositionTable from '../PositionTable';

function position(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    id: 'pos-1',
    portfolio_id: 'pf-1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    quantity: 10,
    entry_price: 100,
    currency: 'USD',
    metadata: {},
    ...overrides,
  } as PortfolioPosition;
}

function renderWithI18n(ui: React.ReactElement, locale: 'de' | 'en' = 'de') {
  window.localStorage.setItem('ausgabentracker_locale_v1', locale);
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe('PositionTable — Kaufdatum & annualisierte Rendite', () => {
  describe('Normal Behavior', () => {
    it('sollte die neuen Spaltenköpfe auf Deutsch rendern', () => {
      renderWithI18n(<PositionTable positions={[position()]} />, 'de');
      expect(screen.getByText('Kaufdatum')).toBeInTheDocument();
      expect(screen.getByText('% p.a.')).toBeInTheDocument();
    });

    it('sollte die neuen Spaltenköpfe auf Englisch rendern', () => {
      renderWithI18n(<PositionTable positions={[position()]} />, 'en');
      expect(screen.getByText('Buy date')).toBeInTheDocument();
      expect(screen.getByText('% p.a.')).toBeInTheDocument();
    });

    it('sollte das eToro-Kaufdatum (metadata.open_date) formatiert anzeigen', () => {
      renderWithI18n(
        <PositionTable positions={[position({ metadata: { open_date: '2024-03-15T09:30:00Z' } })]} />,
        'de',
      );
      expect(screen.getByText('15.3.2024')).toBeInTheDocument();
    });

    it('sollte die annualisierte Rendite für eine Position mit Kaufdatum und Kursgewinn anzeigen', () => {
      // +10% über ~1 Jahr → ca. +10% p.a. — genauer Wert hängt vom Testdatum ab,
      // daher nur prüfen, dass die Zelle einen Prozentwert (kein Strich) zeigt.
      const buyDate = new Date();
      buyDate.setFullYear(buyDate.getFullYear() - 1);
      renderWithI18n(
        <PositionTable
          positions={[
            position({
              last_price: 110,
              metadata: { buy_date: buyDate.toISOString().slice(0, 10) },
            }),
          ]}
        />,
        'de',
      );
      // G/V% zeigt +10.00%, % p.a. einen eigenen annualisierten Wert —
      // beide Zellen müssen einen Prozentwert zeigen, kein Strich ("—") übrig.
      const percentCells = screen.getAllByText(/\+\d+\.\d{2}%/);
      expect(percentCells.length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText('—')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('sollte ohne Kaufdatum einen Gedankenstrich in beiden neuen Spalten zeigen', () => {
      renderWithI18n(<PositionTable positions={[position()]} />, 'de');
      // Kaufdatum-Zelle und % p.a.-Zelle zeigen beide "—"
      expect(screen.getAllByText('—')).toHaveLength(2);
    });

    it('sollte bei zu kurzer Haltedauer (< 30 Tage) keine annualisierte Rendite extrapolieren', () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 3);
      renderWithI18n(
        <PositionTable
          positions={[
            position({ last_price: 110, metadata: { buy_date: recent.toISOString().slice(0, 10) } }),
          ]}
        />,
        'de',
      );
      // Kaufdatum wird angezeigt, aber % p.a. bleibt ein Strich
      expect(screen.getAllByText('—')).toHaveLength(1);
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte alle neuen i18n-Keys in allen Sprachen haben', () => {
      const keys = ['trading.positionTable.headerBuyDate', 'trading.positionTable.headerAnnualized'];
      const locales = [translations.de, translations.en, translations.tlh];
      keys.forEach((key) => {
        const path = key.split('.');
        locales.forEach((locale) => {
          let value = locale as Record<string, unknown>;
          path.forEach((p) => {
            expect(value[p], `${key} fehlt`).toBeDefined();
            value = value[p] as Record<string, unknown>;
          });
        });
      });
    });
  });
});
