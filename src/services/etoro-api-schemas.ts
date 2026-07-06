import { z } from 'zod';

// -----------------------------------------------------------------------------
// eToro API — Response-Verträge (Quelle: Live-OpenAPI-Spec über den
// eToro-MCP-Connector, api v1.291.0, abgefragt am 2026-07-05).
//
// WARUM dieser Datei: Issue #195 — ein Sync lief erfolgreich durch ("44
// aktualisiert"), aber alle Positionen behielten ihre Platzhalter-Symbole,
// weil fetchEtoroInstrumentMeta() auf ein erfundenes Response-Shape prüfte
// (nacktes Array / { instruments: [...] }) statt auf die echte Hülle
// ({ instrumentDisplayDatas: [...] }). Der Test dazu war grün, weil sein Mock
// dieselbe falsche Annahme wiederholte statt die reale API zu spiegeln.
//
// Regel: Response-Shapes externer APIs werden HIER als Zod-Schema festgehalten
// — direkt aus der Live-Spec kopiert, nicht aus dem Gedächtnis rekonstruiert.
// Tests validieren ihre Mock-Fixtures gegen genau dieses Schema (siehe
// etoro-api-schemas.test.ts), damit ein Mock, der von der Realität abweicht,
// beim Testlauf selbst auffliegt — nicht erst live beim Nutzer.
//
// Bei jeder Änderung an einem eToro-Endpoint: Spec erneut über den
// eToro-MCP-Connector (get-route-spec) abfragen und dieses Schema aktualisieren,
// bevor Parser-Code angepasst wird.
// -----------------------------------------------------------------------------

export const EtoroInstrumentDisplayDataSchema = z.object({
  instrumentID: z.number(),
  instrumentDisplayName: z.string().optional(),
  instrumentTypeID: z.number().optional(),
  exchangeID: z.number().optional(),
  symbolFull: z.string(),
  stocksIndustryId: z.number().optional(),
  priceSource: z.string().optional(),
  hasExpirationDate: z.boolean().optional(),
  isInternalInstrument: z.boolean().optional(),
});

export const EtoroInstrumentsResponseSchema = z.object({
  instrumentDisplayDatas: z.array(EtoroInstrumentDisplayDataSchema),
});

export type EtoroInstrumentsResponse = z.infer<typeof EtoroInstrumentsResponseSchema>;

// -----------------------------------------------------------------------------
// GET /api/v1/market-data/instruments/rates (abgefragt 2026-07-05).
// Liefert Live-Kurse je instrumentID — kollisionsfrei, im Gegensatz zu
// Yahoo-Tickern (siehe quote-service.ts isEtoroPosition).
// -----------------------------------------------------------------------------

export const EtoroRateSchema = z.object({
  instrumentID: z.number(),
  ask: z.number().optional(),
  bid: z.number().optional(),
  lastExecution: z.number().optional(),
  date: z.string().optional(),
});

export const EtoroLiveRatesResponseSchema = z.object({
  rates: z.array(EtoroRateSchema),
});

export type EtoroLiveRatesResponse = z.infer<typeof EtoroLiveRatesResponseSchema>;

// -----------------------------------------------------------------------------
// GET /api/v1/trading/info/aggregate-portfolio (Spec abgefragt 2026-07-05,
// v1.291.0). Vollständiger Konto-Snapshot: Konto-Totals (inkl. Cash), pro
// Instrument aggregierte Positionen und Copy-Trading-Beziehungen (mirrors =
// Smart Portfolios). Die Portfolio-Antwort selbst liefert kein Cash/Mirror —
// deshalb dieser separate Endpoint.
//
// Die Spec markiert außer den Identifikatoren keine Felder als required;
// reale Antworten liefern für alte/leere Mirrors teils null/fehlende Werte.
// Daher: Identifikatoren (instrumentId, mirrorId) verpflichtend, Kennzahlen
// optional, explizit nullable nur wo die Spec es sagt (pnlAssetCurrency).
// -----------------------------------------------------------------------------

export const EtoroAccountTotalsSchema = z.object({
  accountAvailableCash: z.number().optional(),
  accountFrozenCash: z.number().optional(),
  accountCurrentPnl: z.number().optional(),
  accountTotalValue: z.number().optional(),
  accountTotalUsedMargin: z.number().optional(),
  accountBalance: z.number().optional(),
});

export const EtoroInstrumentAggregateSchema = z.object({
  instrumentId: z.number(),
  assetCurrency: z.string().optional(),
  totalMarginAccountCurrency: z.number().optional(),
  totalFees: z.number().optional(),
  totalFeesAcctCcy: z.number().optional(),
  totalTaxes: z.number().optional(),
  totalTaxesAcctCcy: z.number().optional(),
  totalMarginAssetCurrency: z.number().optional(),
  pnlAssetCurrency: z.number().nullable().optional(),
  accountCurrencyRoePercent: z.number().optional(),
  netContracts: z.number().optional(),
  netUnits: z.number().optional(),
  netCurrentExposureAssetCurrency: z.number().optional(),
  netCurrentExposureAccountCurrency: z.number().optional(),
  netInitialExposureAccountCurrency: z.number().optional(),
  accountCurrencyReturn: z.number().optional(),
  liquidationValueAccountCurrency: z.number().optional(),
  liquidationValueAssetCurrency: z.number().optional(),
  avgLeverage: z.number().optional(),
  avgOpenRate: z.number().optional(),
  netAvgOpenRate: z.number().optional(),
  avgConversionRate: z.number().optional(),
});

export const EtoroMirrorTotalsSchema = z.object({
  mirrorNetFunding: z.number().optional(),
  mirrorPositionsPnl: z.number().optional(),
  mirrorLiquidationValue: z.number().optional(),
  mirrorPositionsPnlPercent: z.number().optional(),
  mirrorMarginPercent: z.number().optional(),
  mirrorValuePercent: z.number().optional(),
  mirrorActiveMargin: z.number().optional(),
});

export const EtoroMirrorAggregateSchema = z.object({
  mirrorId: z.number(),
  mirrorAvailableCash: z.number().optional(),
  mirrorDepositTotal: z.number().optional(),
  mirrorWithdrawalTotal: z.number().optional(),
  mirrorStopLossPercentage: z.number().optional(),
  mirrorStopLoss: z.number().optional(),
  mirrorClosedPositionsPnl: z.number().optional(),
  mirrorTotals: EtoroMirrorTotalsSchema.optional(),
  instrumentAggregates: z.array(EtoroInstrumentAggregateSchema).optional(),
});

export const EtoroAggregatePortfolioResponseSchema = z.object({
  cid: z.number().optional(),
  timestamp: z.string().optional(),
  accountCurrency: z.string().optional(),
  accountTotals: EtoroAccountTotalsSchema.optional(),
  instrumentAggregates: z.array(EtoroInstrumentAggregateSchema).optional(),
  mirrors: z.array(EtoroMirrorAggregateSchema).optional(),
});

export type EtoroAggregatePortfolioResponse = z.infer<typeof EtoroAggregatePortfolioResponseSchema>;
export type EtoroAccountTotals = z.infer<typeof EtoroAccountTotalsSchema>;
export type EtoroMirrorAggregate = z.infer<typeof EtoroMirrorAggregateSchema>;
export type EtoroInstrumentAggregate = z.infer<typeof EtoroInstrumentAggregateSchema>;

// -----------------------------------------------------------------------------
// GET /api/v1/trading/info/trade/history (Spec abgefragt 2026-07-06, v1.291.0).
// Liste geschlossener Trades (Handelshistorie) — nacktes Array als Top-Level-
// Antwort (keine benannte Hülle, anders als instruments/rates/aggregate).
//
// Die Spec markiert keines der Item-Felder als required; wir verlangen daher
// nur die Identifikatoren (positionId, instrumentId) verpflichtend, alle
// Kennzahlen optional — analog zur aggregate-portfolio-Konvention oben.
// -----------------------------------------------------------------------------

export const EtoroClosedTradeSchema = z.object({
  positionId: z.number(),
  instrumentId: z.number(),
  netProfit: z.number().optional(),
  closeRate: z.number().optional(),
  closeTimestamp: z.string().optional(),
  openRate: z.number().optional(),
  openTimestamp: z.string().optional(),
  isBuy: z.boolean().optional(),
  leverage: z.number().optional(),
  stopLossRate: z.number().optional(),
  takeProfitRate: z.number().optional(),
  trailingStopLoss: z.boolean().optional(),
  orderId: z.number().optional(),
  socialTradeId: z.number().optional(),
  parentPositionId: z.number().optional(),
  investment: z.number().optional(),
  initialInvestment: z.number().optional(),
  fees: z.number().optional(),
  units: z.number().optional(),
});

export const EtoroTradeHistoryResponseSchema = z.array(EtoroClosedTradeSchema);

export type EtoroClosedTrade = z.infer<typeof EtoroClosedTradeSchema>;
export type EtoroTradeHistoryResponse = z.infer<typeof EtoroTradeHistoryResponseSchema>;

// -----------------------------------------------------------------------------
// GET /api/v1/trading/info/real/pnl (Spec abgefragt 2026-07-06, v1.291.0).
// Konto-P&L: Guthaben, Bonus-Guthaben, unrealisierte Gesamt-G/V sowie je
// Mirror die realisierte G/V geschlossener Positionen (closedPositionsNetProfit
// — in aggregate-portfolio nicht enthalten). Response-Hülle laut Spec-Schema
// "PortfolioResponseWithPnl": { clientPortfolio: {...} }.
//
// Wir bilden hier nur den für die Historie-Ansicht benötigten Ausschnitt von
// ClientPortfolio/Mirror ab (nicht positions/orders — die liefert bereits
// aggregate-portfolio bzw. die Positions-Tabelle). Zusätzliche, hier nicht
// gelistete Felder der echten Antwort werden von Zod stillschweigend
// ignoriert (kein .strict()), verändern also nicht das Validierungsergebnis.
// -----------------------------------------------------------------------------

export const EtoroPnlMirrorSchema = z.object({
  mirrorID: z.number(),
  closedPositionsNetProfit: z.number().optional(),
  parentUsername: z.string().optional(),
});

export const EtoroClientPortfolioPnlSchema = z.object({
  credit: z.number().optional(),
  bonusCredit: z.number().optional(),
  unrealizedPnL: z.number().optional(),
  mirrors: z.array(EtoroPnlMirrorSchema).optional(),
});

export const EtoroPnlResponseSchema = z.object({
  clientPortfolio: EtoroClientPortfolioPnlSchema.optional(),
});

export type EtoroPnlMirror = z.infer<typeof EtoroPnlMirrorSchema>;
export type EtoroClientPortfolioPnl = z.infer<typeof EtoroClientPortfolioPnlSchema>;
export type EtoroPnlResponse = z.infer<typeof EtoroPnlResponseSchema>;
