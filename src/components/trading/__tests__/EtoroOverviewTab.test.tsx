import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { translations } from '@/i18n/translations';
import { EtoroAggregatePortfolioResponseSchema } from '@/services/etoro-api-schemas';
import { EtoroAccountError } from '@/services/etoro-account-service';
import EtoroOverviewTab from '../EtoroOverviewTab';
import EtoroScopeGate from '../EtoroScopeGate';

const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
  accountCurrency: 'USD',
  accountTotals: {
    accountAvailableCash: 4320.84,
    accountFrozenCash: 12.5,
    accountCurrentPnl: -300.35,
    accountTotalValue: 5154.48,
    accountTotalUsedMargin: 1133.99,
    accountBalance: 4333.34,
  },
});

describe('EtoroOverviewTab', () => {
  describe('Normal Behavior', () => {
    it('sollte Kontowerte in USD anzeigen (nie EUR-Default)', () => {
      renderWithI18n(
        <EtoroOverviewTab isLocked={false} isLoading={false} error={null} aggregate={aggregate} localPositionsValue={4800} mirrorsValue={0} />,
        'de',
      );
      // Gesamtwert als USD, nicht EUR
      expect(screen.getAllByText(/5\.154,48\s*\$/).length).toBeGreaterThan(0);
      expect(screen.getByText(/4\.320,84\s*\$/)).toBeInTheDocument();
      expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    });

    it('sollte englische Labels rendern', () => {
      renderWithI18n(
        <EtoroOverviewTab isLocked={false} isLoading={false} error={null} aggregate={aggregate} localPositionsValue={4800} mirrorsValue={0} />,
        'en',
      );
      expect(screen.getByText('Available cash')).toBeInTheDocument();
      expect(screen.getByText('Used margin')).toBeInTheDocument();
    });

    it('sollte den lokalen Positions-Abgleichswert anzeigen', () => {
      renderWithI18n(
        <EtoroOverviewTab isLocked={false} isLoading={false} error={null} aggregate={aggregate} localPositionsValue={4800} mirrorsValue={0} />,
        'de',
      );
      expect(screen.getByText(/4\.800,00\s*\$/)).toBeInTheDocument();
    });

    it('sollte Smart Portfolios (mirrorsValue) im Abgleich anzeigen', () => {
      renderWithI18n(
        <EtoroOverviewTab isLocked={false} isLoading={false} error={null} aggregate={aggregate} localPositionsValue={4800} mirrorsValue={200} />,
        'de',
      );
      expect(screen.getByText(/200,00\s*\$/)).toBeInTheDocument();
    });
  });

  describe('Abgleich-Differenz', () => {
    it('sollte die Differenz-Zeile ohne Warn-Tone zeigen, wenn Positionen+Cash+Mirrors ~ Kontowert ergeben', () => {
      // accountTotalValue=5154.48; localPositions=4800 + cash(4320.84+12.5=4333.34) + mirrors=0
      // → Differenz sehr groß hier absichtlich klein gehalten durch abweichenden Testfall unten.
      const closeAggregate = EtoroAggregatePortfolioResponseSchema.parse({
        accountTotals: {
          accountAvailableCash: 100,
          accountFrozenCash: 0,
          accountTotalValue: 1000,
        },
      });
      renderWithI18n(
        <EtoroOverviewTab
          isLocked={false}
          isLoading={false}
          error={null}
          aggregate={closeAggregate}
          localPositionsValue={895}
          mirrorsValue={5}
        />,
        'de',
      );
      // diff = 1000 - (895+100+5) = 0 → unter der 1%-Schwelle, kein Warn-Tone
      const diffLabel = screen.getByText('Differenz');
      const diffValue = diffLabel.nextElementSibling as HTMLElement;
      expect(diffValue.textContent).toMatch(/0,00\s*\$/);
      expect(diffValue.className).not.toContain('text-warning');
    });

    it('[REGRESSION] sollte die Differenz-Zeile mit Warn-Tone zeigen, wenn die Abweichung > 1% des Kontowerts ist', () => {
      const gapAggregate = EtoroAggregatePortfolioResponseSchema.parse({
        accountTotals: {
          accountAvailableCash: 100,
          accountFrozenCash: 0,
          accountTotalValue: 1000,
        },
      });
      renderWithI18n(
        <EtoroOverviewTab
          isLocked={false}
          isLoading={false}
          error={null}
          aggregate={gapAggregate}
          localPositionsValue={700}
          mirrorsValue={0}
        />,
        'de',
      );
      // diff = 1000 - (700+100+0) = 200 → 20% des Kontowerts, deutlich über 1%
      const diffLabel = screen.getByText('Differenz');
      const diffValue = diffLabel.nextElementSibling as HTMLElement;
      expect(diffValue.textContent).toMatch(/200,00\s*\$/);
      expect(diffValue.className).toContain('text-warning');
    });
  });

  describe('Gate-Zustände', () => {
    it('sollte bei gesperrter Verschlüsselung einen Hinweis statt Daten zeigen', () => {
      renderWithI18n(
        <EtoroOverviewTab isLocked isLoading={false} error={null} aggregate={undefined} localPositionsValue={0} mirrorsValue={0} />,
        'de',
      );
      expect(screen.getByText('Verschlüsselung gesperrt')).toBeInTheDocument();
      expect(screen.queryByText('Verfügbares Cash')).not.toBeInTheDocument();
    });

    it('[REGRESSION] sollte bei fehlendem Scope (401/403) einen Berechtigungshinweis statt Crash zeigen', () => {
      renderWithI18n(
        <EtoroOverviewTab
          isLocked={false}
          isLoading={false}
          error={new EtoroAccountError('unauthorized', true)}
          aggregate={undefined}
          localPositionsValue={0}
          mirrorsValue={0}
        />,
        'de',
      );
      expect(screen.getByText('Fehlende Berechtigung')).toBeInTheDocument();
    });
  });
});

describe('EtoroScopeGate', () => {
  it('sollte bei generischem Fehler die Fehlermeldung + Retry-Button zeigen', () => {
    let retried = false;
    renderWithI18n(
      <EtoroScopeGate isLocked={false} isLoading={false} error={new Error('Netzwerk weg')} onRetry={() => { retried = true; }}>
        <div>inhalt</div>
      </EtoroScopeGate>,
      'de',
    );
    expect(screen.getByText('Netzwerk weg')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Erneut versuchen/i });
    btn.click();
    expect(retried).toBe(true);
  });

  it('sollte Kinder rendern wenn kein Fehler/Ladezustand/Sperre vorliegt', () => {
    renderWithI18n(
      <EtoroScopeGate isLocked={false} isLoading={false} error={null}>
        <div>echter inhalt</div>
      </EtoroScopeGate>,
      'de',
    );
    expect(screen.getByText('echter inhalt')).toBeInTheDocument();
  });

  it('sollte im Ladezustand einen Spinner mit Statusrolle zeigen', () => {
    renderWithI18n(
      <EtoroScopeGate isLocked={false} isLoading error={null}>
        <div>inhalt</div>
      </EtoroScopeGate>,
      'de',
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('inhalt')).not.toBeInTheDocument();
  });
});

describe('i18n-Compliance (eToro Übersicht)', () => {
  it('[REGRESSION] sollte alle neuen trading.etoro-Keys in de/en/tlh haben', () => {
    const keys = [
      'trading.etoro.tabs.overview',
      'trading.etoro.gate.lockedTitle',
      'trading.etoro.gate.scopeMissingTitle',
      'trading.etoro.gate.errorTitle',
      'trading.etoro.gate.retry',
      'trading.etoro.overview.accountTotalValue',
      'trading.etoro.overview.availableCash',
      'trading.etoro.overview.openPnl',
      'trading.etoro.overview.reconcileHint',
      'trading.etoro.overview.mirrorsValue',
      'trading.etoro.overview.totalValueHint',
      'trading.etoro.overview.reconcileDiff',
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
      'etoroService.unexpectedResponse',
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
