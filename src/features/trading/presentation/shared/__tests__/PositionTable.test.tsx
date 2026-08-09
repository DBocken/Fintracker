import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
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

describe('PositionTable — Währung je Position (VE-1)', () => {
  it('[REGRESSION] sollte Gewinn/Verlust in der Währung DER POSITION beschriften, nie in der des Depots', () => {
    // Die Zelle formatierte den Betrag bis WP 7.7 mit der DEPOTwährung: In
    // einem EUR-Depot stand über dem Gewinn einer USD-Position ein Euro-Zeichen
    // — dieselbe stumme Umdeutung, die `getPortfolioSummary` in der Summe
    // gemacht hat, nur eine Zeile tiefer und ohne Summe.
    renderWithI18n(<PositionTable positions={[position({ currency: 'USD', last_price: 110 })]} />, 'de');

    const cells = screen.getAllByRole('row')[1].querySelectorAll('td');
    const gainLossCell = cells[6];
    expect(gainLossCell.textContent).toContain('$');
    expect(gainLossCell.textContent).not.toContain('€');
  });
});

describe('PositionTable — Core Table Behavior', () => {
  describe('Empty State', () => {
    it('sollte einen Hinweis statt einer leeren Tabelle zeigen, wenn keine Positionen vorhanden sind', () => {
      renderWithI18n(<PositionTable positions={[]} />, 'de');
      expect(screen.getByText('Keine Positionen vorhanden')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Sortierung', () => {
    function rowSymbols() {
      const rows = screen.getAllByRole('row').slice(1); // erste Zeile ist der Header
      return rows.map((r) => within(r).getAllByRole('cell')[0].textContent);
    }

    it('sollte nach Symbol sortieren beim Klick auf den Spaltenkopf', () => {
      renderWithI18n(
        <PositionTable positions={[position({ id: 'p1', symbol: 'TSLA' }), position({ id: 'p2', symbol: 'AAPL' })]} />,
        'de',
      );
      // Erster Klick auf eine neue Spalte sortiert absteigend (Z→A für Text).
      fireEvent.click(screen.getByText('Symbol'));
      expect(rowSymbols()).toEqual(['TSLA', 'AAPL']);

      // Erneuter Klick auf dieselbe Spalte kehrt die Richtung um.
      fireEvent.click(screen.getByText('Symbol'));
      expect(rowSymbols()).toEqual(['AAPL', 'TSLA']);
    });

    it('sollte Positionen ohne Kaufdatum unabhängig von der Sortierrichtung ans Ende stellen', () => {
      renderWithI18n(
        <PositionTable
          positions={[
            position({ id: 'no-date', symbol: 'NODATE' }),
            position({ id: 'with-date', symbol: 'WITHDATE', metadata: { open_date: '2024-01-01' } }),
          ]}
        />,
        'de',
      );
      fireEvent.click(screen.getByText('Kaufdatum'));
      expect(rowSymbols()).toEqual(['WITHDATE', 'NODATE']);
      fireEvent.click(screen.getByText('Kaufdatum'));
      expect(rowSymbols()).toEqual(['WITHDATE', 'NODATE']);
    });
  });

  describe('Bearbeiten & Löschen', () => {
    it('sollte onEdit mit der Position aufrufen, wenn der Bearbeiten-Button geklickt wird', () => {
      const onEdit = vi.fn();
      const pos = position();
      renderWithI18n(<PositionTable positions={[pos]} onEdit={onEdit} />, 'de');
      fireEvent.click(screen.getByRole('row', { name: /AAPL/ }).querySelectorAll('button')[0]);
      expect(onEdit).toHaveBeenCalledWith(pos);
    });

    it('sollte onDelete erst nach Bestätigung im Dialog mit der Position-ID aufrufen', () => {
      const onDelete = vi.fn();
      const pos = position({ symbol: 'MSFT' });
      renderWithI18n(<PositionTable positions={[pos]} onDelete={onDelete} />, 'de');

      fireEvent.click(screen.getByRole('row', { name: /MSFT/ }).querySelectorAll('button')[0]);
      expect(screen.getByText('Position löschen?')).toBeInTheDocument();
      expect(onDelete).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
      expect(onDelete).toHaveBeenCalledWith(pos.id);
    });
  });

  describe('Gewinn/Verlust-Grenzfall', () => {
    it('sollte bei last_price === entry_price (Nullgewinn) als Gewinn (>= 0) grün darstellen', () => {
      renderWithI18n(<PositionTable positions={[position({ entry_price: 100, last_price: 100 })]} />, 'de');
      expect(screen.getByText('+0.00%')).toBeInTheDocument();
    });
  });
});

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
