/**
 * Tab „Positionen" — die Positionsliste des aktiven Depots.
 *
 * Aus `TradingDashboard.tsx` herausgelöst (WP 6.3). Der Ladezustand bleibt
 * unverändert das Zeilen-Skelett aus WP-8.4: Zeilen in der Form der Tabelle
 * statt eines kreisenden Symbols.
 */
import type { PortfolioPosition } from '@/types';
import { LoadingSwap } from '@/features/shared/presentation/LoadingSwap';
import { Skeleton } from '@/components/ui/skeleton';
import PositionTable from '../shared/PositionTable';

export interface TradingPositionsTabProps {
  positions: PortfolioPosition[] | undefined;
  isLoading: boolean;
  currency: string;
  onEdit: (position: PortfolioPosition) => void;
  onDelete: (id: string) => void;
}

export default function TradingPositionsTab({
  positions,
  isLoading,
  currency,
  onEdit,
  onDelete,
}: TradingPositionsTabProps) {
  if (isLoading) {
    return (
      <LoadingSwap
        loading
        skeleton={
          <div data-testid="trading-positions-skeleton" className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="shimmer" className="h-12 w-full" />
            ))}
          </div>
        }
      >
        {null}
      </LoadingSwap>
    );
  }

  return (
    <PositionTable
      positions={positions || []}
      onEdit={onEdit}
      onDelete={onDelete}
      currency={currency}
    />
  );
}
