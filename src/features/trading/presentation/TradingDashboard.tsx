/**
 * Trading-Fläche — Kompositionswurzel der Slice `features/trading`.
 *
 * WP 6.3 (ARCH-5/KOMP-1): Diese Datei stand als 746-Zeilen-Komponente in
 * `src/components/trading/TradingDashboard.tsx`. Die Slice hatte `domain/` und
 * `application/`, aber keine `presentation/` — die Migration hatte die
 * Datenschicht herausgezogen und die UI-Komplexität stehen lassen.
 *
 * Zerlegt ist die Fläche jetzt entlang ihrer Tabs: Kopfzeile und Kennzahlen in
 * `shared/`, je Tab ein Baustein in `tabs/`, die eToro-Bausteine in `etoro/`,
 * die Dialoge in `dialogs/`. Diese Datei tut nur noch dreierlei: die beiden
 * ViewModels lesen, die Zustände der ganzen Fläche (Fehler, Laden) entscheiden
 * und die Bausteine zusammensetzen.
 *
 * Die ViewModels selbst (`use-etoro-account`, `use-trading-portfolio`) sind
 * dabei UNVERÄNDERT geblieben — das ist der Beleg, dass die Trennung trägt.
 */
import { useI18n } from '@/i18n/useI18n';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingSwap } from '@/features/shared/presentation/LoadingSwap';
import FinanceErrorState from '@/features/shared/presentation/FinanceErrorState';
import { UnconvertedCurrencyNotice } from '@/features/shared/presentation/UnconvertedCurrencyNotice';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { toast } from 'react-hot-toast';
import { useEtoroAccount } from '@/features/trading/application/use-etoro-account';
import { useTradingPortfolio } from '@/features/trading/application/use-trading-portfolio';
import TradingHeader from './shared/TradingHeader';
import TradingSummaryStats from './shared/TradingSummaryStats';
import TradingTabsBar from './shared/TradingTabsBar';
import EtoroTabPanels from './tabs/EtoroTabPanels';
import TradingPositionsTab from './tabs/TradingPositionsTab';
import TradingPerformanceTab from './tabs/TradingPerformanceTab';
import TradingPortfoliosTab from './tabs/TradingPortfoliosTab';
import EtoroConnectDialog from './dialogs/EtoroConnectDialog';
import AddPositionDialog from './dialogs/AddPositionDialog';
import OcrImportDialog from './dialogs/OcrImportDialog';

export default function TradingDashboard() {
  const { t } = useI18n();

  // Depot-Kern: Depot, Positionen, Kennzahlen, Kursaktualisierung und die
  // Mutationen dazu. Liegt in `features/trading/application`.
  const portfolio = useTradingPortfolio();

  // eToro-Bereiche: zwanzig Abfragen über sieben Tabs, samt Tab-, Watchlist-,
  // News- und Discover-Zustand. Liegt daneben in `features/trading/application`
  // — siehe dort, warum jede Abfrage tab-gattert ist (Rate-Limit von eToro).
  const etoro = useEtoroAccount({
    portfolio: portfolio.activePortfolio,
    positions: portfolio.positions,
  });

  if (portfolio.hasLoadError) {
    return <FinanceErrorState variant="data" onRetry={portfolio.retryAll} />;
  }

  if (portfolio.isInitializing || portfolio.isLoadingPortfolio) {
    // WP-8.4: Choreografie aus WP-7.3. Der Platzhalter zeichnet vor, was
    // kommt — Kopfzeile, Kennzahlenreihe, Positionsliste — statt nur zu
    // sagen, dass etwas passiert.
    return (
      <LoadingSwap
        loading
        skeleton={
          <div data-testid="trading-dashboard-skeleton" className="space-y-6">
            <Skeleton variant="shimmer" className="h-8 w-56" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} variant="shimmer" className="h-24 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton variant="shimmer" className="h-64 w-full rounded-lg" />
          </div>
        }
      >
        {null}
      </LoadingSwap>
    );
  }

  return (
    <div className="space-y-6">
      <TradingHeader
        activePortfolio={portfolio.activePortfolio}
        positions={portfolio.positions}
        quoteProvider={portfolio.quoteProvider}
        favoriteProvider={portfolio.preferredProvider}
        onProviderChange={portfolio.handleProviderChange}
        isRefreshingQuotes={portfolio.refreshQuotesMutation.isPending}
        onRefreshQuotes={() => portfolio.refreshQuotesMutation.mutate()}
        onAddPosition={portfolio.startAddPosition}
        onImportImage={() => portfolio.setIsOcrImportDialogOpen(true)}
        onImportCsv={() => toast(t('trading.dashboard.csvComingSoon'))}
        isSyncingEtoro={portfolio.etoroSyncMutation.isPending}
        onSyncEtoro={() => portfolio.etoroSyncMutation.mutate()}
        onConnectEtoro={() => portfolio.setIsEtoroDialogOpen(true)}
        lastUpdate={portfolio.lastUpdate}
      />

      {portfolio.summary && (
        <TradingSummaryStats summary={portfolio.summary} isEtoro={etoro.isEtoro} />
      )}

      {/* VE-1: Was nicht in der Depotwährung notiert, steckt nicht im
          Gesamtwert darüber — und muss deshalb genau hier stehen. */}
      {portfolio.summary && (
        <UnconvertedCurrencyNotice
          description={t('currency.unconverted.portfolioDescription')}
          items={portfolio.summary.unconverted_positions.map((position) => ({
            key: position.id,
            label: position.symbol,
            hint: position.name,
            currency: position.currency,
            value: position.value,
          }))}
        />
      )}

      <Tabs value={etoro.effectiveTab} onValueChange={etoro.setActiveTab} className="space-y-4">
        <TradingTabsBar isEtoro={etoro.isEtoro} />

        {etoro.isEtoro && <EtoroTabPanels etoro={etoro} />}

        <TabsContent value="positions" className="space-y-4">
          <TradingPositionsTab
            positions={portfolio.positions}
            isLoading={portfolio.isLoadingPositions}
            onEdit={portfolio.handleEditPosition}
            onDelete={portfolio.handleDeletePosition}
          />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <TradingPerformanceTab
            isEtoro={etoro.isEtoro}
            summary={portfolio.summary}
            etoro={{
              isLocked: !etoro.unlocked,
              isLoading: etoro.isLoadingBalancesHistory,
              error: etoro.balancesHistoryError,
              onRetry: () => etoro.refetchBalancesHistory(),
              series: etoro.performanceSeries,
            }}
          />
        </TabsContent>

        <TabsContent value="portfolios" className="space-y-4">
          <TradingPortfoliosTab
            activePortfolioId={portfolio.activePortfolio?.id}
            onPortfolioChange={portfolio.handlePortfolioChange}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EtoroConnectDialog
        open={portfolio.isEtoroDialogOpen}
        onOpenChange={portfolio.setIsEtoroDialogOpen}
        onSuccess={portfolio.handleEtoroSuccess}
      />
      <AddPositionDialog
        open={portfolio.isAddPositionDialogOpen}
        onOpenChange={portfolio.handleAddPositionDialogClose}
        portfolioId={portfolio.activePortfolio?.id || ''}
        editPosition={portfolio.editPosition}
      />
      <OcrImportDialog
        open={portfolio.isOcrImportDialogOpen}
        onOpenChange={portfolio.setIsOcrImportDialogOpen}
        portfolioId={portfolio.activePortfolio?.id || ''}
      />
    </div>
  );
}
