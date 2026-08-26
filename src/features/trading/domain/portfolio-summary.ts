/**
 * Depot-Kennzahlen aus Positionen — rein, ohne I/O.
 *
 * Lag bis Welle 2 als `getPortfolioSummary` im `portfolio-service`, wo sie
 * zuerst gebraucht wurde. Der Dienst holte Depot und Positionen und rechnete
 * in derselben Funktion; wer die Rechnung ohne Datenbank brauchte — ein
 * Registereintrag etwa — hätte sie nachbauen müssen. Die Ladung bleibt beim
 * Dienst, die Rechnung steht hier.
 *
 * Hier und nicht in `src/lib/`, weil `currentPriceOf` in dieser Slice liegt:
 * `lib` darf eine Feature-`domain` nicht importieren (AGENTS.md §3), und den
 * Kurs-Zugriff bloss deshalb zu verschieben hiesse, die Ablage der Regel
 * nachzugeben statt der Sache.
 */
import type { Portfolio, PortfolioPosition, PortfolioSummary, UnconvertedPosition } from '@/types';
import { isSameCurrency } from '@/lib/portfolio-currency';
import { currentPriceOf } from '@/features/trading/domain/position-metrics';

/**
 * Investiertes Kapital einer Position. eToro-Positionen speichern das
 * tatsächlich eingesetzte Kapital (`invested_amount`, aus dem `amount`-Feld
 * der Portfolio-API) — bei Hebel ist Menge × Einstiegskurs die Exposure,
 * nicht das eingesetzte Kapital, und würde "Investiert" künstlich aufblähen.
 */
function positionCostBasis(position: PortfolioPosition): number {
  const investedAmount = position.metadata?.invested_amount;
  if (typeof investedAmount === 'number' && Number.isFinite(investedAmount)) {
    return investedAmount;
  }
  return position.quantity * position.entry_price;
}

export function summarizePortfolio(
  portfolio: Portfolio,
  positions: readonly PortfolioPosition[],
): PortfolioSummary {
  let total_value = 0;
  let total_cost = 0;
  const unconverted_positions: UnconvertedPosition[] = [];

  for (const position of positions) {
    const currentPrice = currentPriceOf(position);
    const marketValue = position.quantity * currentPrice;

    // VE-1 (docs/architecture/currency-eur-only.md): Es gibt keine Kursquelle
    // und keine Umrechnung. Eine Position in einer anderen Währung als der
    // Depotwährung darf deshalb NICHT addiert werden — 1:1 summiert ergäbe das
    // beim damaligen EUR/USD-Kurs rund 8 % Fehler, und zwar lautlos. Sie wird
    // stattdessen benannt (F-DEBT-2, T1.11, WP 7.7).
    if (!isSameCurrency(position.currency, portfolio.currency)) {
      unconverted_positions.push({
        id: position.id,
        symbol: position.symbol,
        name: position.name,
        currency: position.currency,
        value: marketValue,
      });
      continue;
    }

    total_value += marketValue;
    total_cost += positionCostBasis(position);
  }

  const unrealized_gain_loss = total_value - total_cost;
  const unrealized_gain_loss_percent = total_cost > 0 ? (unrealized_gain_loss / total_cost) * 100 : 0;

  return {
    total_value,
    total_cost,
    unrealized_gain_loss,
    unrealized_gain_loss_percent,
    positions_count: positions.length,
    currency: portfolio.currency,
    unconverted_positions,
  };
}
