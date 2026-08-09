import type { PortfolioPosition } from '@/types';

// -----------------------------------------------------------------------------
// Positions-Kennzahlen (aus PositionTable extrahiert, damit sie testbar sind
// und Dashboard/Tabelle dieselbe Rechenbasis nutzen).
// -----------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365.25;

// Unter dieser Haltedauer wird nicht annualisiert: +5% nach 3 Tagen als
// "+600% p.a." anzuzeigen wäre rechnerisch korrekt, aber irreführend.
export const MIN_HOLDING_DAYS_FOR_ANNUALIZED = 30;

export function calculateGainLoss(position: PortfolioPosition): number {
  const currentPrice = position.last_price || position.entry_price;
  return (currentPrice - position.entry_price) * position.quantity;
}

export function calculateGainLossPercent(position: PortfolioPosition): number {
  const currentPrice = position.last_price || position.entry_price;
  if (position.entry_price === 0) return 0;
  return ((currentPrice - position.entry_price) / position.entry_price) * 100;
}

/**
 * Kaufdatum einer Position: manuell gepflegtes `buy_date` hat Vorrang vor dem
 * von eToro importierten `open_date` (wer das Datum bewusst editiert, meint es).
 */
export function getBuyDate(position: PortfolioPosition): Date | null {
  const raw = position.metadata?.buy_date ?? position.metadata?.open_date;
  if (typeof raw !== 'string' || raw.length === 0) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Annualisierte Rendite (CAGR) in Prozent, oder null wenn nicht sinnvoll
 * berechenbar: fehlendes/zukünftiges Kaufdatum, Haltedauer unter
 * MIN_HOLDING_DAYS_FOR_ANNUALIZED oder Basis <= 0 (Totalverlust).
 */
export function calculateAnnualizedReturnPercent(
  position: PortfolioPosition,
  now: Date = new Date(),
): number | null {
  const buyDate = getBuyDate(position);
  if (!buyDate) return null;

  const holdingDays = (now.getTime() - buyDate.getTime()) / MS_PER_DAY;
  if (holdingDays < MIN_HOLDING_DAYS_FOR_ANNUALIZED) return null;

  const growthFactor = 1 + calculateGainLossPercent(position) / 100;
  if (growthFactor <= 0) return null;

  const years = holdingDays / DAYS_PER_YEAR;
  return (Math.pow(growthFactor, 1 / years) - 1) * 100;
}
