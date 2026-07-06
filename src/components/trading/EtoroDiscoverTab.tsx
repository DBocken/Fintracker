import type { FormEvent } from 'react';
import { Search, ListChecks, LineChart as LineChartIcon, UserSearch, BadgeCheck } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/common/EmptyState';
import { InfoGroup } from '@/components/common/InfoGroup';
import InteractiveCard from '@/components/common/InteractiveCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EtoroCandlestickChart from './EtoroCandlestickChart';
import type {
  CandlePoint,
  InstrumentSearchResultView,
  CuratedListView,
  PublicUserProfileView,
} from '@/services/etoro-discover';
import EtoroScopeGate from './EtoroScopeGate';

// eToro-Konten laufen in USD — nie das EUR-Default.
const USD = 'USD';

export interface EtoroDiscoverInstrumentOption {
  instrumentId: number;
  name: string;
}

interface EtoroDiscoverSectionState {
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

interface EtoroDiscoverTabProps {
  isLocked: boolean;

  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  searchResults: InstrumentSearchResultView[];
  searchState: EtoroDiscoverSectionState & { hasSearched: boolean };

  curatedLists: CuratedListView[];
  curatedListsState: EtoroDiscoverSectionState;

  selectedInstrument: EtoroDiscoverInstrumentOption | undefined;
  onSelectInstrument: (option: EtoroDiscoverInstrumentOption) => void;
  candles: CandlePoint[];
  candlesState: EtoroDiscoverSectionState;

  usernameQuery: string;
  onUsernameQueryChange: (value: string) => void;
  onUsernameSubmit: () => void;
  userProfile: PublicUserProfileView | undefined;
  userProfileState: EtoroDiscoverSectionState & { hasSearched: boolean };
}

/**
 * Discover-Tab: Instrument-Suche, kuratierte Listen, Kursverlauf (Candles) des
 * ausgewählten Instruments und öffentliche Trader-Profile. Alle vier
 * Datenquellen sind unabhängig (eigenes EtoroScopeGate je Sektion) — Suche und
 * Trader-Profil sind nutzer-getriggert (kein Auto-Fetch bei leerer Eingabe).
 */
export default function EtoroDiscoverTab({
  isLocked,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  searchResults,
  searchState,
  curatedLists,
  curatedListsState,
  selectedInstrument,
  onSelectInstrument,
  candles,
  candlesState,
  usernameQuery,
  onUsernameQueryChange,
  onUsernameSubmit,
  userProfile,
  userProfileState,
}: EtoroDiscoverTabProps) {
  const { t } = useI18n();

  if (isLocked) {
    return (
      <EtoroScopeGate isLocked isLoading={false} error={null}>
        <></>
      </EtoroScopeGate>
    );
  }

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearchSubmit();
  };

  const handleTraderSubmit = (e: FormEvent) => {
    e.preventDefault();
    onUsernameSubmit();
  };

  const instrumentFallback = (id: number) => t('trading.etoro.discover.instrumentFallback').replace('{id}', String(id));

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-medium text-muted-foreground">{t('trading.etoro.discover.title')}</h2>

      <InfoGroup title={t('trading.etoro.discover.searchTitle')}>
        <form className="flex gap-2" onSubmit={handleSearchSubmit}>
          <Input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={t('trading.etoro.discover.searchPlaceholder')}
            aria-label={t('trading.etoro.discover.searchTitle')}
          />
          <Button type="submit" disabled={!searchQuery.trim()}>
            <Search className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('trading.etoro.discover.searchButton')}
          </Button>
        </form>

        <div className="mt-4">
          <EtoroScopeGate isLocked={false} isLoading={searchState.isLoading} error={searchState.error} onRetry={searchState.onRetry}>
            {!searchState.hasSearched ? (
              <EmptyState
                icon={Search}
                title={t('trading.etoro.discover.searchIdleTitle')}
                description={t('trading.etoro.discover.searchIdleDesc')}
              />
            ) : searchResults.length === 0 ? (
              <EmptyState
                icon={Search}
                title={t('trading.etoro.discover.searchEmptyTitle')}
                description={t('trading.etoro.discover.searchEmptyDesc').replace('{query}', searchQuery)}
              />
            ) : (
              <ul className="space-y-2">
                {searchResults.map((result) => (
                  <li key={result.instrumentId}>
                    <InteractiveCard
                      onClick={() => onSelectInstrument({ instrumentId: result.instrumentId, name: result.name })}
                      aria-label={result.name}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{result.name}</span>
                        {result.rate != null && (
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(result.rate, USD)}</span>
                        )}
                      </div>
                      {result.symbol && <div className="mt-1 text-xs text-muted-foreground">{result.symbol}</div>}
                    </InteractiveCard>
                  </li>
                ))}
              </ul>
            )}
          </EtoroScopeGate>
        </div>
      </InfoGroup>

      <InfoGroup title={t('trading.etoro.discover.curatedTitle')}>
        <EtoroScopeGate
          isLocked={false}
          isLoading={curatedListsState.isLoading}
          error={curatedListsState.error}
          onRetry={curatedListsState.onRetry}
        >
          {curatedLists.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title={t('trading.etoro.discover.curatedEmptyTitle')}
              description={t('trading.etoro.discover.curatedEmptyDesc')}
            />
          ) : (
            <div className="space-y-4">
              {curatedLists.map((list) => (
                <div key={list.uuid} className="space-y-2">
                  <div>
                    <div className="text-sm font-medium">{list.name}</div>
                    {list.description && <div className="text-xs text-muted-foreground">{list.description}</div>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {list.instrumentIds.map((id) => (
                      <Button
                        key={id}
                        type="button"
                        variant={selectedInstrument?.instrumentId === id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onSelectInstrument({ instrumentId: id, name: instrumentFallback(id) })}
                      >
                        {instrumentFallback(id)}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </EtoroScopeGate>
      </InfoGroup>

      <InfoGroup title={t('trading.etoro.discover.chartTitle')}>
        {!selectedInstrument ? (
          <EmptyState
            icon={LineChartIcon}
            title={t('trading.etoro.discover.chartEmptyTitle')}
            description={t('trading.etoro.discover.chartEmptyDesc')}
          />
        ) : (
          <EtoroScopeGate isLocked={false} isLoading={candlesState.isLoading} error={candlesState.error} onRetry={candlesState.onRetry}>
            <div className="space-y-2">
              <div className="text-sm font-medium">{selectedInstrument.name}</div>
              {candles.length === 0 ? (
                <EmptyState
                  icon={LineChartIcon}
                  title={t('trading.etoro.discover.chartEmptyTitle')}
                  description={t('trading.etoro.discover.chartEmptyDesc')}
                />
              ) : (
                <EtoroCandlestickChart candles={candles} />
              )}
            </div>
          </EtoroScopeGate>
        )}
      </InfoGroup>

      <InfoGroup title={t('trading.etoro.discover.traderTitle')}>
        <form className="flex gap-2" onSubmit={handleTraderSubmit}>
          <Input
            value={usernameQuery}
            onChange={(e) => onUsernameQueryChange(e.target.value)}
            placeholder={t('trading.etoro.discover.traderPlaceholder')}
            aria-label={t('trading.etoro.discover.traderTitle')}
          />
          <Button type="submit" disabled={!usernameQuery.trim()}>
            <UserSearch className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('trading.etoro.discover.traderButton')}
          </Button>
        </form>

        <div className="mt-4">
          <EtoroScopeGate
            isLocked={false}
            isLoading={userProfileState.isLoading}
            error={userProfileState.error}
            onRetry={userProfileState.onRetry}
          >
            {!userProfileState.hasSearched ? (
              <EmptyState
                icon={UserSearch}
                title={t('trading.etoro.discover.traderIdleTitle')}
                description={t('trading.etoro.discover.traderIdleDesc')}
              />
            ) : !userProfile ? (
              <EmptyState
                icon={UserSearch}
                title={t('trading.etoro.discover.traderEmptyTitle')}
                description={t('trading.etoro.discover.traderEmptyDesc').replace('{username}', usernameQuery)}
              />
            ) : (
              <div className="flex items-center gap-4 rounded-xl bg-muted/30 p-4">
                {userProfile.avatarUrl && (
                  <img
                    src={userProfile.avatarUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{userProfile.username}</span>
                    {userProfile.isVerified && (
                      <Badge variant="secondary" className="gap-1">
                        <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                        {t('trading.etoro.discover.traderVerifiedBadge')}
                      </Badge>
                    )}
                  </div>
                  {userProfile.aboutMe && <p className="mt-1 text-xs text-muted-foreground">{userProfile.aboutMe}</p>}
                </div>
              </div>
            )}
          </EtoroScopeGate>
        </div>
      </InfoGroup>
    </div>
  );
}
