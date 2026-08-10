/**
 * Tab „Portfolios verwalten".
 *
 * Aus `TradingDashboard.tsx` herausgelöst (WP 6.3). Der Tab ist die Hülle um
 * `PortfolioManager`; dessen Depotliste und Schreibvorgänge liegen seit WP 6.3
 * im ViewModel `application/use-trading-portfolios.ts`. Ohne diesen Schritt
 * hätte der Baustein vier Datenzugriffe an `pnpm check:view-data` vorbeigetragen
 * (die Zahl wäre gesunken, ohne dass sich etwas verbessert hätte) — er war die
 * letzte Trading-Fläche mit einer eigenen LESENDEN Abfrage.
 */
import type { Portfolio } from '@/types';
import PortfolioManager from '../shared/PortfolioManager';

export interface TradingPortfoliosTabProps {
  activePortfolioId: string | undefined;
  onPortfolioChange: (portfolio: Portfolio) => void;
}

export default function TradingPortfoliosTab({
  activePortfolioId,
  onPortfolioChange,
}: TradingPortfoliosTabProps) {
  return (
    <PortfolioManager
      activePortfolioId={activePortfolioId}
      onPortfolioChange={onPortfolioChange}
    />
  );
}
