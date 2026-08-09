import { Newspaper } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import EmptyState from '@/features/shared/presentation/EmptyState';
import SegmentedControl from '@/features/shared/presentation/SegmentedControl';
import type { EtoroDiscussionsResponse } from '@/services/etoro-api-schemas';
import { selectFeedPosts, selectMergedMarketFeed } from '@/services/etoro-feeds';
import EtoroScopeGate from './EtoroScopeGate';

// Der Zustandstyp liegt in der `domain` des Slices — das ViewModel darf ihn
// nicht aus einer Komponentendatei holen (check:layers, feature-application-ohne-ui).
import type { EtoroNewsFilter } from '@/features/trading/domain/etoro-view-state';
export type { EtoroNewsFilter };

interface EtoroNewsSectionState {
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

interface EtoroNewsTabProps {
  isLocked: boolean;
  filter: EtoroNewsFilter;
  onFilterChange: (filter: EtoroNewsFilter) => void;
  /** "Alle"-Feed (/feeds/news). */
  newsFeed: EtoroNewsSectionState & { data: EtoroDiscussionsResponse | undefined };
  /** "Meine Positionen"-Feed: ein Aufruf je gehaltenem Instrument, hier gemergt. */
  positionsFeed: EtoroNewsSectionState & { responses: Array<EtoroDiscussionsResponse | undefined> };
}

function formatPostDate(timestamp: string | undefined, locale: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale === 'de' ? 'de-DE' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * News- & Markt-Feeds-Tab für eToro-Portfolios (read-only). Zeigt
 * ausschließlich reinen Text — niemals dangerouslySetInnerHTML — da
 * Feed-Beiträge nutzergenerierter Inhalt und damit ein potenzielles
 * XSS-Ziel sind (siehe EtoroNewsTab-Tests, [REGRESSION] HTML-Text).
 */
export default function EtoroNewsTab({ isLocked, filter, onFilterChange, newsFeed, positionsFeed }: EtoroNewsTabProps) {
  const { t, locale } = useI18n();

  if (isLocked) {
    return (
      <EtoroScopeGate isLocked isLoading={false} error={null}>
        <></>
      </EtoroScopeGate>
    );
  }

  const isMyPositions = filter === 'my-positions';
  const posts = isMyPositions ? selectMergedMarketFeed(positionsFeed.responses) : selectFeedPosts(newsFeed.data);
  const sectionState = isMyPositions ? positionsFeed : newsFeed;

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-medium text-muted-foreground">{t('trading.etoro.news.title')}</h2>

      <SegmentedControl
        aria-label={t('trading.etoro.news.filterLabel')}
        value={filter}
        onValueChange={onFilterChange}
        options={[
          { value: 'all', label: t('trading.etoro.news.filterAll') },
          { value: 'my-positions', label: t('trading.etoro.news.filterMyPositions') },
        ]}
      />

      <EtoroScopeGate isLocked={false} isLoading={sectionState.isLoading} error={sectionState.error} onRetry={sectionState.onRetry}>
        {posts.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title={t('trading.etoro.news.emptyTitle')}
            description={isMyPositions ? t('trading.etoro.news.emptyMyPositionsDesc') : t('trading.etoro.news.emptyAllDesc')}
          />
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.id} className="space-y-1 rounded-lg bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                  <span className="font-medium">
                    {post.username || t('trading.etoro.news.unknownAuthor')}
                  </span>
                  <span>{formatPostDate(post.createdAt, locale)}</span>
                </div>
                {/* Reiner Text-Node — React escaped automatisch, niemals dangerouslySetInnerHTML. */}
                <p className="whitespace-pre-wrap text-sm">{post.text}</p>
              </li>
            ))}
          </ul>
        )}
      </EtoroScopeGate>
    </div>
  );
}
