import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { translations } from '@/i18n/translations';
import { EtoroTradeHistoryResponseSchema, EtoroPnlResponseSchema } from '@/services/etoro-api-schemas';
import { EtoroAccountError } from '@/services/etoro-account-service';
import EtoroHistoryTab from '../EtoroHistoryTab';

function renderWithI18n(ui: React.ReactElement, locale: 'de' | 'en' = 'de') {
  window.localStorage.setItem('ausgabentracker_locale_v1', locale);
  return render(<I18nProvider>{ui}</I18nProvider>);
}

const tradeHistory = EtoroTradeHistoryResponseSchema.parse([
  {
    positionId: 1,
    instrumentId: 1001,
    isBuy: true,
    leverage: 2,
    openTimestamp: '2026-01-01T00:00:00Z',
    closeTimestamp: '2026-02-01T00:00:00Z',
    investment: 500,
    fees: 2.5,
    netProfit: 47.5,
  },
  {
    positionId: 2,
    instrumentId: 1002,
    isBuy: false,
    leverage: 1,
    openTimestamp: '2026-01-05T00:00:00Z',
    closeTimestamp: '2026-01-10T00:00:00Z',
    investment: 200,
    fees: 1,
    netProfit: -30,
  },
]);

const pnl = EtoroPnlResponseSchema.parse({
  clientPortfolio: {
    credit: 10000.5,
    bonusCredit: 500,
    unrealizedPnL: 251,
    mirrors: [{ mirrorID: 1, closedPositionsNetProfit: 350.75 }],
  },
});

const instrumentMeta = new Map([
  [1001, { symbol: 'AAPL', name: 'Apple Inc.' }],
  [1002, { symbol: 'TSLA' }],
]);

function noopSection<T>(data: T | undefined) {
  return { data, isLoading: false, error: null };
}

describe('EtoroHistoryTab', () => {
  describe('Normal Behavior', () => {
    it('sollte die Konto-P&L-Kennzahlen mit USD-Werten anzeigen (nie EUR-Default)', () => {
      renderWithI18n(
        <EtoroHistoryTab
          isLocked={false}
          pnl={noopSection(pnl)}
          tradeHistory={noopSection(tradeHistory)}
          instrumentMeta={instrumentMeta}
        />,
        'de',
      );
      expect(screen.getAllByText(/10\.000,50\s*\$/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    });

    it('sollte geschlossene Trades absteigend nach Schließdatum auflisten mit aufgelösten Instrumentnamen', () => {
      renderWithI18n(
        <EtoroHistoryTab
          isLocked={false}
          pnl={noopSection(pnl)}
          tradeHistory={noopSection(tradeHistory)}
          instrumentMeta={instrumentMeta}
        />,
        'de',
      );
      const rows = screen.getAllByRole('row').slice(1); // Header-Zeile überspringen
      expect(rows).toHaveLength(2);
      // Position 1 schloss am 2026-02-01, Position 2 am 2026-01-10 → 1 zuerst.
      expect(rows[0]).toHaveTextContent('Apple Inc.');
      expect(rows[1]).toHaveTextContent('TSLA');
    });

    it('sollte Buy/Sell-Badges korrekt zuordnen', () => {
      renderWithI18n(
        <EtoroHistoryTab
          isLocked={false}
          pnl={noopSection(pnl)}
          tradeHistory={noopSection(tradeHistory)}
          instrumentMeta={instrumentMeta}
        />,
        'de',
      );
      expect(screen.getByText('Kauf')).toBeInTheDocument();
      expect(screen.getByText('Verkauf')).toBeInTheDocument();
    });

    it('sollte Instrumente ohne Metadaten mit Fallback "Instrument #<id>" anzeigen', () => {
      renderWithI18n(<EtoroHistoryTab isLocked={false} pnl={noopSection(pnl)} tradeHistory={noopSection(tradeHistory)} />, 'de');
      expect(screen.getByText('Instrument #1001')).toBeInTheDocument();
      expect(screen.getByText('Instrument #1002')).toBeInTheDocument();
    });

    it('sollte englische Labels rendern', () => {
      renderWithI18n(
        <EtoroHistoryTab isLocked={false} pnl={noopSection(pnl)} tradeHistory={noopSection(tradeHistory)} />,
        'en',
      );
      expect(screen.getByText('Account P&L')).toBeInTheDocument();
      expect(screen.getByText('Closed trades')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('sollte einen Empty-State zeigen, wenn keine geschlossenen Trades vorhanden sind', () => {
      renderWithI18n(<EtoroHistoryTab isLocked={false} pnl={noopSection(pnl)} tradeHistory={noopSection([])} />, 'de');
      expect(screen.getByText('Keine geschlossenen Trades')).toBeInTheDocument();
    });

    it('sollte einen Empty-State zeigen, wenn tradeHistory undefined ist', () => {
      renderWithI18n(<EtoroHistoryTab isLocked={false} pnl={noopSection(pnl)} tradeHistory={noopSection(undefined)} />, 'de');
      expect(screen.getByText('Keine geschlossenen Trades')).toBeInTheDocument();
    });

    it('sollte 0-Werte anzeigen, wenn pnl undefined ist', () => {
      renderWithI18n(<EtoroHistoryTab isLocked={false} pnl={noopSection(undefined)} tradeHistory={noopSection(tradeHistory)} />, 'de');
      expect(screen.getAllByText(/^0,00\s*\$$/).length).toBeGreaterThan(0);
    });
  });

  describe('Gate-Zustände', () => {
    it('sollte bei gesperrter Verschlüsselung einen Hinweis statt Daten zeigen', () => {
      renderWithI18n(
        <EtoroHistoryTab isLocked pnl={noopSection(undefined)} tradeHistory={noopSection(undefined)} />,
        'de',
      );
      expect(screen.getByText('Verschlüsselung gesperrt')).toBeInTheDocument();
      expect(screen.queryByText('Keine geschlossenen Trades')).not.toBeInTheDocument();
    });

    it('sollte pro Sektion unabhängig laden (P&L lädt, Trades bereits da)', () => {
      renderWithI18n(
        <EtoroHistoryTab
          isLocked={false}
          pnl={{ data: undefined, isLoading: true, error: null }}
          tradeHistory={noopSection(tradeHistory)}
          instrumentMeta={instrumentMeta}
        />,
        'de',
      );
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    });

    it('[REGRESSION] sollte bei fehlendem Scope (401/403) in einer Sektion einen Berechtigungshinweis zeigen, ohne die andere Sektion zu blockieren', () => {
      renderWithI18n(
        <EtoroHistoryTab
          isLocked={false}
          pnl={{ data: undefined, isLoading: false, error: new EtoroAccountError('unauthorized', true) }}
          tradeHistory={noopSection(tradeHistory)}
          instrumentMeta={instrumentMeta}
        />,
        'de',
      );
      expect(screen.getByText('Fehlende Berechtigung')).toBeInTheDocument();
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    });
  });

  describe('i18n-Compliance (eToro Historie)', () => {
    it('[REGRESSION] sollte alle neuen trading.etoro.history-Keys in de/en/tlh haben', () => {
      const keys = [
        'trading.etoro.tabs.history',
        'trading.etoro.history.title',
        'trading.etoro.history.pnlSection',
        'trading.etoro.history.credit',
        'trading.etoro.history.bonusCredit',
        'trading.etoro.history.unrealizedPnl',
        'trading.etoro.history.mirrorsRealizedPnl',
        'trading.etoro.history.tradesSection',
        'trading.etoro.history.tradesCount',
        'trading.etoro.history.tradesNetProfit',
        'trading.etoro.history.tradesFees',
        'trading.etoro.history.columnInstrument',
        'trading.etoro.history.columnDirection',
        'trading.etoro.history.directionBuy',
        'trading.etoro.history.directionSell',
        'trading.etoro.history.columnOpened',
        'trading.etoro.history.columnClosed',
        'trading.etoro.history.columnLeverage',
        'trading.etoro.history.columnInvestment',
        'trading.etoro.history.columnNetProfit',
        'trading.etoro.history.instrumentFallback',
        'trading.etoro.history.emptyTitle',
        'trading.etoro.history.emptyDesc',
      ];
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
