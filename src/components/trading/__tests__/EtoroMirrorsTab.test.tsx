import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { translations } from '@/i18n/translations';
import { EtoroAggregatePortfolioResponseSchema } from '@/services/etoro-api-schemas';
import { EtoroAccountError } from '@/services/etoro-account-service';
import EtoroMirrorsTab from '../EtoroMirrorsTab';

const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
  mirrors: [
    {
      mirrorId: 42,
      mirrorClosedPositionsPnl: 0,
      mirrorTotals: {
        mirrorNetFunding: 214.5,
        mirrorPositionsPnl: -75.05,
        mirrorLiquidationValue: 209.08,
        mirrorPositionsPnlPercent: -0.35,
      },
      instrumentAggregates: [{ instrumentId: 1001 }, { instrumentId: 1002 }],
    },
  ],
});

const instrumentMeta = new Map([
  [1001, { symbol: 'AAPL', name: 'Apple Inc.' }],
  [1002, { symbol: 'TSLA' }],
]);

describe('EtoroMirrorsTab', () => {
  describe('Normal Behavior', () => {
    it('sollte Mirror-Karten mit USD-Werten anzeigen (nie EUR-Default)', () => {
      renderWithI18n(
        <EtoroMirrorsTab
          isLocked={false}
          isLoading={false}
          error={null}
          aggregate={aggregate}
          instrumentMeta={instrumentMeta}
        />,
        'de',
      );
      expect(screen.getAllByText(/209,08\s*\$/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    });

    it('sollte den Faktor mirrorPositionsPnlPercent als ×100-Prozent anzeigen (-35%, nicht -0,35%)', () => {
      renderWithI18n(
        <EtoroMirrorsTab isLocked={false} isLoading={false} error={null} aggregate={aggregate} />,
        'de',
      );
      expect(screen.getByText(/-35\.00%/)).toBeInTheDocument();
    });

    it('sollte per Klick die Instrumentenliste auf- und zuklappen', () => {
      renderWithI18n(
        <EtoroMirrorsTab
          isLocked={false}
          isLoading={false}
          error={null}
          aggregate={aggregate}
          instrumentMeta={instrumentMeta}
        />,
        'de',
      );
      expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument();

      const card = screen.getByRole('button', { name: /Smart Portfolio #42/i });
      fireEvent.click(card);
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
      expect(screen.getByText('TSLA')).toBeInTheDocument();
      expect(card).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(card);
      expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument();
      expect(card).toHaveAttribute('aria-expanded', 'false');
    });

    it('sollte Instrumente ohne Metadaten mit Fallback "Instrument #<id>" anzeigen', () => {
      renderWithI18n(
        <EtoroMirrorsTab isLocked={false} isLoading={false} error={null} aggregate={aggregate} />,
        'de',
      );
      const card = screen.getByRole('button', { name: /Smart Portfolio #42/i });
      fireEvent.click(card);
      expect(screen.getByText('Instrument #1001')).toBeInTheDocument();
      expect(screen.getByText('Instrument #1002')).toBeInTheDocument();
    });

    it('sollte englische Labels rendern', () => {
      renderWithI18n(
        <EtoroMirrorsTab isLocked={false} isLoading={false} error={null} aggregate={aggregate} />,
        'en',
      );
      expect(screen.getByText('Total value')).toBeInTheDocument();
      expect(screen.getByText('Total net funding')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('sollte einen Empty-State zeigen, wenn keine Mirrors vorhanden sind', () => {
      const emptyAggregate = EtoroAggregatePortfolioResponseSchema.parse({ mirrors: [] });
      renderWithI18n(
        <EtoroMirrorsTab isLocked={false} isLoading={false} error={null} aggregate={emptyAggregate} />,
        'de',
      );
      expect(screen.getByText('Keine Smart Portfolios')).toBeInTheDocument();
    });

    it('sollte einen Empty-State zeigen, wenn aggregate undefined ist', () => {
      renderWithI18n(
        <EtoroMirrorsTab isLocked={false} isLoading={false} error={null} aggregate={undefined} />,
        'de',
      );
      expect(screen.getByText('Keine Smart Portfolios')).toBeInTheDocument();
    });
  });

  describe('Gate-Zustände', () => {
    it('sollte bei gesperrter Verschlüsselung einen Hinweis statt Daten zeigen', () => {
      renderWithI18n(
        <EtoroMirrorsTab isLocked isLoading={false} error={null} aggregate={undefined} />,
        'de',
      );
      expect(screen.getByText('Verschlüsselung gesperrt')).toBeInTheDocument();
      expect(screen.queryByText('Keine Smart Portfolios')).not.toBeInTheDocument();
    });

    it('[REGRESSION] sollte bei fehlendem Scope (401/403) einen Berechtigungshinweis statt Crash zeigen', () => {
      renderWithI18n(
        <EtoroMirrorsTab
          isLocked={false}
          isLoading={false}
          error={new EtoroAccountError('unauthorized', true)}
          aggregate={undefined}
        />,
        'de',
      );
      expect(screen.getByText('Fehlende Berechtigung')).toBeInTheDocument();
    });
  });

  describe('i18n-Compliance (eToro Smart Portfolios)', () => {
    it('[REGRESSION] sollte alle neuen trading.etoro.mirrors-Keys in de/en/tlh haben', () => {
      const keys = [
        'trading.etoro.tabs.mirrors',
        'trading.etoro.mirrors.title',
        'trading.etoro.mirrors.headerValue',
        'trading.etoro.mirrors.headerNetFunding',
        'trading.etoro.mirrors.headerPnl',
        'trading.etoro.mirrors.invested',
        'trading.etoro.mirrors.value',
        'trading.etoro.mirrors.pnl',
        'trading.etoro.mirrors.instruments',
        'trading.etoro.mirrors.portfolioLabel',
        'trading.etoro.mirrors.instrumentFallback',
        'trading.etoro.mirrors.emptyTitle',
        'trading.etoro.mirrors.emptyDesc',
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
