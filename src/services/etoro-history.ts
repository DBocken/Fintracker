import type { EtoroTradeHistoryResponse, EtoroPnlResponse, EtoroCashAccountTransactionsResponse } from './etoro-api-schemas';

// -----------------------------------------------------------------------------
// Historie (eToro geschlossene Trades + Konto-P&L) — reine Selektor-Funktionen
// über die Antworten aus etoro-api-schemas.ts. Keine Netzwerk-/Persistenz-
// Logik hier, nur Ableitung fürs UI (EtoroHistoryTab), analog etoro-mirrors.ts.
// -----------------------------------------------------------------------------

export interface ClosedTradeView {
  positionId: number;
  instrumentId: number;
  isBuy: boolean | undefined;
  leverage: number | undefined;
  openTimestamp: string | undefined;
  closeTimestamp: string | undefined;
  openRate: number | undefined;
  closeRate: number | undefined;
  investment: number | undefined;
  fees: number | undefined;
  netProfit: number;
}

/**
 * Bildet die rohe Trade-History-Antwort auf ein UI-taugliches Shape ab,
 * neuester geschlossener Trade zuerst (closeTimestamp absteigend). Trades
 * ohne closeTimestamp landen ans Ende, unabhängig von der Sortierrichtung.
 */
export function selectClosedTrades(tradeHistory: EtoroTradeHistoryResponse | undefined): ClosedTradeView[] {
  const trades = tradeHistory ?? [];

  return [...trades]
    .map((trade) => ({
      positionId: trade.positionId,
      instrumentId: trade.instrumentId,
      isBuy: trade.isBuy,
      leverage: trade.leverage,
      openTimestamp: trade.openTimestamp,
      closeTimestamp: trade.closeTimestamp,
      openRate: trade.openRate,
      closeRate: trade.closeRate,
      investment: trade.investment,
      fees: trade.fees,
      netProfit: trade.netProfit ?? 0,
    }))
    .sort((a, b) => {
      const timeA = a.closeTimestamp ? new Date(a.closeTimestamp).getTime() : undefined;
      const timeB = b.closeTimestamp ? new Date(b.closeTimestamp).getTime() : undefined;
      if (timeA == null && timeB == null) return 0;
      if (timeA == null) return 1;
      if (timeB == null) return -1;
      return timeB - timeA;
    });
}

/** Summen über alle geschlossenen Trades — für den Kopf des Historie-Tabs. */
export function selectClosedTradesTotals(trades: ClosedTradeView[]): {
  count: number;
  totalNetProfit: number;
  totalFees: number;
} {
  return trades.reduce(
    (acc, trade) => ({
      count: acc.count + 1,
      totalNetProfit: acc.totalNetProfit + trade.netProfit,
      totalFees: acc.totalFees + (trade.fees ?? 0),
    }),
    { count: 0, totalNetProfit: 0, totalFees: 0 },
  );
}

export interface AccountPnlView {
  credit: number | undefined;
  bonusCredit: number | undefined;
  unrealizedPnl: number | undefined;
  /** Σ closedPositionsNetProfit über alle Mirrors — realisierte G/V der Smart Portfolios. */
  mirrorsRealizedPnl: number;
}

/** Bildet die rohe pnl-Antwort auf ein UI-taugliches Shape ab. */
export function selectAccountPnl(pnl: EtoroPnlResponse | undefined): AccountPnlView {
  const clientPortfolio = pnl?.clientPortfolio;
  const mirrorsRealizedPnl = (clientPortfolio?.mirrors ?? []).reduce(
    (sum, mirror) => sum + (mirror.closedPositionsNetProfit ?? 0),
    0,
  );

  return {
    credit: clientPortfolio?.credit,
    bonusCredit: clientPortfolio?.bonusCredit,
    unrealizedPnl: clientPortfolio?.unrealizedPnL,
    mirrorsRealizedPnl,
  };
}

export interface CashMovementView {
  id: string;
  postedAt: string;
  subtype: string;
  direction: 'debit' | 'credit';
  /** Absoluter Betrag (>= 0). */
  amount: number;
  /** Vorzeichenbehafteter Betrag: positiv = Zufluss (credit), negativ = Abfluss (debit). */
  signedAmount: number;
  currency: string;
  counterpartyName: string | undefined;
}

/**
 * Bildet die rohe Cash-Transactions-Antwort auf ein UI-taugliches Shape ab,
 * neueste Bewegung zuerst (postedAt absteigend). `amount` kommt von eToro als
 * Dezimal-String — hier bewusst einmalig in eine Zahl geparst (Number()),
 * nicht weiter in der Kette (Rundungsfallen bei Geldbeträgen vermeiden).
 *
 * eToros transactionSubtype-Enum kennt kein „dividend" — nur Kartenzahlungen,
 * Transfers, Gebühren und Guthaben-Anpassungen (siehe Live-Spec). Das
 * „Cash-Bewegungen"-Segment zeigt daher alle verfügbaren Bewegungsarten, nicht
 * ausschließlich Dividenden/Gebühren.
 */
export function selectCashMovements(transactions: EtoroCashAccountTransactionsResponse | undefined): CashMovementView[] {
  const results = transactions?.results ?? [];

  return [...results]
    .map((tx) => {
      const amount = Math.abs(Number(tx.amount)) || 0;
      return {
        id: tx.id,
        postedAt: tx.postedAt,
        subtype: tx.transactionSubtype,
        direction: tx.direction,
        amount,
        signedAmount: tx.direction === 'debit' ? -amount : amount,
        currency: tx.currency,
        counterpartyName: tx.counterparty?.name,
      };
    })
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
}

/** Summen über alle Cash-Bewegungen — für den Kopf des Cash-Bewegungen-Segments. */
export function selectCashMovementsTotals(movements: CashMovementView[]): {
  count: number;
  totalSigned: number;
  totalFees: number;
} {
  return movements.reduce(
    (acc, m) => ({
      count: acc.count + 1,
      totalSigned: acc.totalSigned + m.signedAmount,
      totalFees: acc.totalFees + (m.subtype === 'fee' ? m.amount : 0),
    }),
    { count: 0, totalSigned: 0, totalFees: 0 },
  );
}
