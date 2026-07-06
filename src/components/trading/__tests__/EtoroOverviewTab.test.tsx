import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { translations } from '@/i18n/translations';
import { EtoroAggregatePortfolioResponseSchema } from '@/services/etoro-api-schemas';
import { EtoroAccountError } from '@/services/etoro-account-service';
import EtoroOverviewTab from '../EtoroOverviewTab';
import EtoroScopeGate from '../EtoroScopeGate';

function renderWithI18n(ui: React.ReactElement, locale: 'de' | 'en' = 'de') {
  window.localStorage.setItem('ausgabentracker_locale_v1', locale);
  return render(<I18nProvider>{ui}</I18nProvider>);
}

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
        <EtoroOverviewTab isLocked={false} isLoading={false} error={null} aggregate={aggregate} localPositionsValue={4800} />,
        'de',
      );
      // Gesamtwert als USD, nicht EUR
      expect(screen.getAllByText(/5\.154,48\s*\$/).length).toBeGreaterThan(0);
      expect(screen.getByText(/4\.320,84\s*\$/)).toBeInTheDocument();
      expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    });

    it('sollte englische Labels rendern', () => {
      renderWithI18n(
        <EtoroOverviewTab isLocked={false} isLoading={false} error={null} aggregate={aggregate} localPositionsValue={4800} />,
        'en',
      );
      expect(screen.getByText('Available cash')).toBeInTheDocument();
      expect(screen.getByText('Used margin')).toBeInTheDocument();
    });

    it('sollte den lokalen Positions-Abgleichswert anzeigen', () => {
      renderWithI18n(
        <EtoroOverviewTab isLocked={false} isLoading={false} error={null} aggregate={aggregate} localPositionsValue={4800} />,
        'de',
      );
      expect(screen.getByText(/4\.800,00\s*\$/)).toBeInTheDocument();
    });
  });

  describe('Gate-Zustände', () => {
    it('sollte bei gesperrter Verschlüsselung einen Hinweis statt Daten zeigen', () => {
      renderWithI18n(
        <EtoroOverviewTab isLocked isLoading={false} error={null} aggregate={undefined} localPositionsValue={0} />,
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
