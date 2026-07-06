import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { translations } from '@/i18n/translations';
import { EtoroAggregatePortfolioResponseSchema } from '@/services/etoro-api-schemas';
import { EtoroAccountError } from '@/services/etoro-account-service';
import EtoroAnalysisTab from '../EtoroAnalysisTab';

function renderWithI18n(ui: React.ReactElement, locale: 'de' | 'en' = 'de') {
  window.localStorage.setItem('ausgabentracker_locale_v1', locale);
  return render(<I18nProvider>{ui}</I18nProvider>);
}

const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
  instrumentAggregates: [
    { instrumentId: 1001, netCurrentExposureAccountCurrency: 600, totalFeesAcctCcy: 5, totalTaxesAcctCcy: 1, accountCurrencyReturn: -10 },
    { instrumentId: 1002, netCurrentExposureAccountCurrency: 400, totalFeesAcctCcy: 2, accountCurrencyReturn: 50 },
  ],
});

const instrumentIndustryMap = new Map([
  [1001, 12],
  [1002, 12],
]);
const industryNameMap = new Map([[12, 'Technology']]);
const instrumentMeta = new Map([
  [1001, { symbol: 'AAPL', name: 'Apple Inc.' }],
  [1002, { symbol: 'TSLA' }],
]);

describe('EtoroAnalysisTab', () => {
  describe('Normal Behavior', () => {
    it('sollte Sektor-Exposure mit USD-Werten anzeigen (nie EUR-Default)', () => {
      renderWithI18n(
        <EtoroAnalysisTab
          isLocked={false}
          isLoading={false}
          error={null}
          aggregate={aggregate}
          instrumentIndustryMap={instrumentIndustryMap}
          industryNameMap={industryNameMap}
        />,
        'de',
      );
      expect(screen.getByText('Technology')).toBeInTheDocument();
      expect(screen.getByText(/1\.000,00\s*\$/)).toBeInTheDocument();
      expect(screen.getByText(/100\.0%/)).toBeInTheDocument();
      expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    });

    it('sollte das Gebühren-/P&L-Breakdown mit aufgelösten Instrumentnamen anzeigen', () => {
      renderWithI18n(
        <EtoroAnalysisTab
          isLocked={false}
          isLoading={false}
          error={null}
          aggregate={aggregate}
          instrumentIndustryMap={instrumentIndustryMap}
          industryNameMap={industryNameMap}
          instrumentMeta={instrumentMeta}
        />,
        'de',
      );
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
      expect(screen.getByText('TSLA')).toBeInTheDocument();
      expect(screen.getByText('+50,00 $')).toBeInTheDocument();
      expect(screen.getByText('-10,00 $')).toBeInTheDocument();
    });

    it('sollte Instrumente ohne Metadaten mit Fallback "Instrument #<id>" anzeigen', () => {
      renderWithI18n(
        <EtoroAnalysisTab
          isLocked={false}
          isLoading={false}
          error={null}
          aggregate={aggregate}
          instrumentIndustryMap={instrumentIndustryMap}
          industryNameMap={industryNameMap}
        />,
        'de',
      );
      expect(screen.getByText('Instrument #1001')).toBeInTheDocument();
      expect(screen.getByText('Instrument #1002')).toBeInTheDocument();
    });

    it('sollte eine unaufgelöste Branchen-ID als Fallback "Branche #<id>" anzeigen', () => {
      renderWithI18n(
        <EtoroAnalysisTab
          isLocked={false}
          isLoading={false}
          error={null}
          aggregate={aggregate}
          instrumentIndustryMap={instrumentIndustryMap}
          industryNameMap={new Map()}
        />,
        'de',
      );
      expect(screen.getByText('Branche #12')).toBeInTheDocument();
    });

    it('sollte "Unbekannte Branche" anzeigen, wenn keine Branche zugeordnet ist', () => {
      renderWithI18n(
        <EtoroAnalysisTab
          isLocked={false}
          isLoading={false}
          error={null}
          aggregate={aggregate}
          instrumentIndustryMap={new Map()}
          industryNameMap={new Map()}
        />,
        'de',
      );
      expect(screen.getByText('Unbekannte Branche')).toBeInTheDocument();
    });

    it('sollte englische Labels rendern', () => {
      renderWithI18n(
        <EtoroAnalysisTab
          isLocked={false}
          isLoading={false}
          error={null}
          aggregate={aggregate}
          instrumentIndustryMap={instrumentIndustryMap}
          industryNameMap={industryNameMap}
        />,
        'en',
      );
      expect(screen.getByText('Sector exposure')).toBeInTheDocument();
      expect(screen.getByText('Fees/P&L breakdown')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('sollte Empty-States zeigen, wenn keine instrumentAggregates vorhanden sind', () => {
      const empty = EtoroAggregatePortfolioResponseSchema.parse({ instrumentAggregates: [] });
      renderWithI18n(
        <EtoroAnalysisTab
          isLocked={false}
          isLoading={false}
          error={null}
          aggregate={empty}
          instrumentIndustryMap={new Map()}
          industryNameMap={new Map()}
        />,
        'de',
      );
      expect(screen.getByText('Keine Sektor-Daten')).toBeInTheDocument();
      expect(screen.getByText('Keine Breakdown-Daten')).toBeInTheDocument();
    });

    it('sollte Empty-States zeigen, wenn aggregate undefined ist', () => {
      renderWithI18n(
        <EtoroAnalysisTab
          isLocked={false}
          isLoading={false}
          error={null}
          aggregate={undefined}
          instrumentIndustryMap={new Map()}
          industryNameMap={new Map()}
        />,
        'de',
      );
      expect(screen.getByText('Keine Sektor-Daten')).toBeInTheDocument();
    });
  });

  describe('Gate-Zustände', () => {
    it('sollte bei gesperrter Verschlüsselung einen Hinweis statt Daten zeigen', () => {
      renderWithI18n(
        <EtoroAnalysisTab
          isLocked
          isLoading={false}
          error={null}
          aggregate={undefined}
          instrumentIndustryMap={new Map()}
          industryNameMap={new Map()}
        />,
        'de',
      );
      expect(screen.getByText('Verschlüsselung gesperrt')).toBeInTheDocument();
      expect(screen.queryByText('Keine Sektor-Daten')).not.toBeInTheDocument();
    });

    it('[REGRESSION] sollte bei fehlendem Scope (401/403) einen Berechtigungshinweis statt Crash zeigen', () => {
      renderWithI18n(
        <EtoroAnalysisTab
          isLocked={false}
          isLoading={false}
          error={new EtoroAccountError('unauthorized', true)}
          aggregate={undefined}
          instrumentIndustryMap={new Map()}
          industryNameMap={new Map()}
        />,
        'de',
      );
      expect(screen.getByText('Fehlende Berechtigung')).toBeInTheDocument();
    });
  });

  describe('i18n-Compliance (eToro Analyse)', () => {
    it('[REGRESSION] sollte alle neuen trading.etoro.analysis-Keys in de/en/tlh haben', () => {
      const keys = [
        'trading.etoro.tabs.analysis',
        'trading.etoro.analysis.title',
        'trading.etoro.analysis.sectorSection',
        'trading.etoro.analysis.sectorEmptyTitle',
        'trading.etoro.analysis.sectorEmptyDesc',
        'trading.etoro.analysis.industryFallback',
        'trading.etoro.analysis.industryUnknown',
        'trading.etoro.analysis.breakdownSection',
        'trading.etoro.analysis.breakdownEmptyTitle',
        'trading.etoro.analysis.breakdownEmptyDesc',
        'trading.etoro.analysis.totalFees',
        'trading.etoro.analysis.totalTaxes',
        'trading.etoro.analysis.totalPnl',
        'trading.etoro.analysis.columnInstrument',
        'trading.etoro.analysis.columnFees',
        'trading.etoro.analysis.columnTaxes',
        'trading.etoro.analysis.columnPnl',
        'trading.etoro.analysis.instrumentFallback',
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
