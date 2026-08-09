/**
 * Die sieben eToro-Tabs (Übersicht, Smart Portfolios, Historie, Analyse,
 * Watchlists, News, Entdecken).
 *
 * Aus `TradingDashboard.tsx` herausgelöst (WP 6.3). Der Baustein verteilt
 * ausschliesslich, was das ViewModel `useEtoroAccount` bereits geladen hat — er
 * fragt selbst nichts ab. Das ist der Grund, warum er das ganze Modell als eine
 * Prop nimmt statt sechzig Einzel-Props: Jede Abfrage im ViewModel ist
 * tab-gattert (eToro-Rate-Limit, siehe `application/etoro-tab-gate.ts`), und die
 * Zuordnung „welcher Tab bekommt welche Antwort" gehört genau hierher.
 *
 * `EtoroAccountModel` wird bewusst aus dem Hook abgeleitet und nicht daneben
 * noch einmal getippt: Ein zweiter, handgeschriebener Typ würde beim nächsten
 * Feld auseinanderlaufen, ohne dass etwas rot wird.
 */
import { TabsContent } from '@/components/ui/tabs';
import {
  selectCandlePoints,
  selectCuratedLists,
  selectInstrumentSearchResults,
  selectPublicUserProfile,
} from '@/services/etoro-discover';
import { sumMirrorLiquidationValue } from '@/services/etoro-mirrors';
import type { useEtoroAccount } from '@/features/trading/application/use-etoro-account';
import EtoroOverviewTab from '../etoro/EtoroOverviewTab';
import EtoroDemoAccountCard from '../etoro/EtoroDemoAccountCard';
import EtoroMirrorsTab from '../etoro/EtoroMirrorsTab';
import EtoroHistoryTab from '../etoro/EtoroHistoryTab';
import EtoroAnalysisTab from '../etoro/EtoroAnalysisTab';
import EtoroWatchlistsTab from '../etoro/EtoroWatchlistsTab';
import EtoroNewsTab from '../etoro/EtoroNewsTab';
import EtoroDiscoverTab from '../etoro/EtoroDiscoverTab';

export type EtoroAccountModel = ReturnType<typeof useEtoroAccount>;

export interface EtoroTabPanelsProps {
  etoro: EtoroAccountModel;
}

export default function EtoroTabPanels({ etoro }: EtoroTabPanelsProps) {
  const isLocked = !etoro.unlocked;

  return (
    <>
      <TabsContent value="overview" className="space-y-4">
        <EtoroOverviewTab
          isLocked={isLocked}
          isLoading={etoro.isLoadingAggregate}
          error={etoro.aggregateError}
          onRetry={() => etoro.refetchAggregate()}
          aggregate={etoro.etoroAggregate}
          localPositionsValue={etoro.localEtoroPositionsValue}
          mirrorsValue={sumMirrorLiquidationValue(etoro.etoroAggregate)}
        />
        <EtoroDemoAccountCard
          isLoading={etoro.isLoadingDemoPnl}
          error={etoro.demoPnlError}
          pnl={etoro.etoroDemoPnl}
        />
      </TabsContent>

      <TabsContent value="mirrors" className="space-y-4">
        <EtoroMirrorsTab
          isLocked={isLocked}
          isLoading={etoro.isLoadingAggregate}
          error={etoro.aggregateError}
          onRetry={() => etoro.refetchAggregate()}
          aggregate={etoro.etoroAggregate}
          instrumentMeta={etoro.mirrorInstrumentMeta}
        />
      </TabsContent>

      <TabsContent value="history" className="space-y-4">
        <EtoroHistoryTab
          isLocked={isLocked}
          pnl={{
            data: etoro.etoroPnl,
            isLoading: etoro.isLoadingPnl,
            error: etoro.pnlError,
            onRetry: () => etoro.refetchPnl(),
          }}
          tradeHistory={{
            data: etoro.etoroTradeHistory,
            isLoading: etoro.isLoadingTradeHistory,
            error: etoro.tradeHistoryError,
            onRetry: () => etoro.refetchTradeHistory(),
          }}
          cashMovements={{
            data: etoro.etoroCashMovements,
            isLoading: etoro.isLoadingBalances || etoro.isLoadingCashMovements,
            error: etoro.balancesError ?? etoro.cashMovementsError,
            onRetry: () => {
              etoro.refetchBalances();
              if (etoro.cashAccountId) etoro.refetchCashMovements();
            },
          }}
          instrumentMeta={etoro.tradeHistoryInstrumentMeta}
        />
      </TabsContent>

      <TabsContent value="analysis" className="space-y-4">
        <EtoroAnalysisTab
          isLocked={isLocked}
          isLoading={etoro.isLoadingAggregate}
          error={etoro.aggregateError}
          onRetry={() => etoro.refetchAggregate()}
          aggregate={etoro.etoroAggregate}
          instrumentIndustryMap={etoro.analysisInstrumentIndustryMap}
          industryNameMap={etoro.analysisIndustryNameMap ?? new Map()}
          instrumentMeta={etoro.analysisInstrumentMeta}
        />
      </TabsContent>

      <TabsContent value="watchlists" className="space-y-4">
        <EtoroWatchlistsTab
          isLocked={isLocked}
          watchlists={{
            data: etoro.etoroWatchlists,
            isLoading: etoro.isLoadingWatchlists,
            error: etoro.watchlistsError,
            onRetry: () => etoro.refetchWatchlists(),
          }}
          selectedWatchlistId={etoro.effectiveWatchlistId}
          onSelectWatchlist={etoro.setSelectedWatchlistId}
          watchlistItems={{
            data: etoro.etoroWatchlistItems,
            isLoading: etoro.isLoadingWatchlistItems,
            error: etoro.watchlistItemsError,
            onRetry: () => etoro.refetchWatchlistItems(),
          }}
          priceAlerts={{
            data: etoro.etoroPriceAlerts,
            isLoading: etoro.isLoadingPriceAlerts,
            error: etoro.priceAlertsError,
            onRetry: () => etoro.refetchPriceAlerts(),
          }}
          rates={etoro.watchlistsRates ?? new Map()}
        />
      </TabsContent>

      <TabsContent value="news" className="space-y-4">
        <EtoroNewsTab
          isLocked={isLocked}
          filter={etoro.newsFilter}
          onFilterChange={etoro.setNewsFilter}
          newsFeed={{
            data: etoro.etoroNewsFeed,
            isLoading: etoro.isLoadingNewsFeed,
            error: etoro.newsFeedError,
            onRetry: () => etoro.refetchNewsFeed(),
          }}
          positionsFeed={{
            responses: etoro.positionsFeedQueries.map((q) => q.data),
            isLoading: etoro.isLoadingPositionsFeed,
            error: etoro.positionsFeedError,
            onRetry: etoro.refetchPositionsFeed,
          }}
        />
      </TabsContent>

      <TabsContent value="discover" className="space-y-4">
        <EtoroDiscoverTab
          isLocked={isLocked}
          searchQuery={etoro.discoverSearchInput}
          onSearchQueryChange={etoro.setDiscoverSearchInput}
          onSearchSubmit={() => etoro.setDiscoverSearchQuery(etoro.discoverSearchInput.trim())}
          searchResults={selectInstrumentSearchResults(etoro.etoroInstrumentSearch)}
          searchState={{
            isLoading: etoro.isLoadingInstrumentSearch,
            error: etoro.instrumentSearchError,
            onRetry: () => etoro.refetchInstrumentSearch(),
            hasSearched: etoro.discoverSearchQuery.length > 0,
          }}
          curatedLists={selectCuratedLists(etoro.etoroCuratedLists)}
          curatedListsState={{
            isLoading: etoro.isLoadingCuratedLists,
            error: etoro.curatedListsError,
            onRetry: () => etoro.refetchCuratedLists(),
          }}
          selectedInstrument={etoro.discoverSelectedInstrument}
          onSelectInstrument={etoro.setDiscoverSelectedInstrument}
          candles={selectCandlePoints(etoro.etoroInstrumentCandles)}
          candlesState={{
            isLoading: etoro.isLoadingCandles,
            error: etoro.candlesError,
            onRetry: () => etoro.refetchCandles(),
          }}
          usernameQuery={etoro.discoverUsernameInput}
          onUsernameQueryChange={etoro.setDiscoverUsernameInput}
          onUsernameSubmit={() => etoro.setDiscoverUsername(etoro.discoverUsernameInput.trim())}
          userProfile={selectPublicUserProfile(etoro.etoroPublicUserInfo)}
          userProfileState={{
            isLoading: etoro.isLoadingPublicUserInfo,
            error: etoro.publicUserInfoError,
            onRetry: () => etoro.refetchPublicUserInfo(),
            hasSearched: etoro.discoverUsername.length > 0,
          }}
        />
      </TabsContent>
    </>
  );
}
