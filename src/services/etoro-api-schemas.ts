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

// -----------------------------------------------------------------------------
// GET /api/v1/balances (Spec abgefragt 2026-07-06, v1.291.0). Aggregierte
// Kontostände über alle eToro-Produkte (Trading, Cash, Options, Crypto, ...).
// Liefert u. a. die Cash-Account-ID, die cash-transactions als Pfad-Parameter
// benötigt — die Portfolio-/Aggregate-Antworten kennen sie nicht.
// -----------------------------------------------------------------------------

export const EtoroAccountBalanceSchema = z.object({
  accountId: z.string().nullable().optional(),
  accountType: z.string(),
  balance: z.number().optional(),
  currency: z.string().nullable().optional(),
  displayBalance: z.number().optional(),
  displayCurrency: z.string().nullable().optional(),
});

export const EtoroBalancesResponseSchema = z.object({
  gcid: z.number().optional(),
  totalBalance: z.number().optional(),
  displayCurrency: z.string().nullable().optional(),
  balances: z.array(EtoroAccountBalanceSchema).optional(),
});

export type EtoroAccountBalance = z.infer<typeof EtoroAccountBalanceSchema>;
export type EtoroBalancesResponse = z.infer<typeof EtoroBalancesResponseSchema>;

// -----------------------------------------------------------------------------
// GET /api/v1/balances/history (Spec abgefragt 2026-07-06, v1.291.0). Tägliche
// Kontostand-Snapshots (letzte 12 Monate, max. 365 Tage Spanne pro Anfrage) —
// ersetzt den bisherigen synthetischen Performance-Chart-Mock im Client.
// -----------------------------------------------------------------------------

export const EtoroHistoricalDailySnapshotSchema = z.object({
  date: z.string(),
  totalCash: z.number().optional(),
  totalInvestedAmount: z.number().optional(),
  totalPnl: z.number().optional(),
  totalBalance: z.number().optional(),
  displayTotalCash: z.number().optional(),
  displayTotalInvestedAmount: z.number().optional(),
  displayTotalPnl: z.number().optional(),
  displayTotalBalance: z.number().optional(),
});

export const EtoroHistoricalBalancesResponseSchema = z.object({
  gcid: z.number().optional(),
  displayCurrency: z.string().nullable().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  snapshots: z.array(EtoroHistoricalDailySnapshotSchema).optional(),
});

export type EtoroHistoricalDailySnapshot = z.infer<typeof EtoroHistoricalDailySnapshotSchema>;
export type EtoroHistoricalBalancesResponse = z.infer<typeof EtoroHistoricalBalancesResponseSchema>;

// -----------------------------------------------------------------------------
// GET /api/v1/money/accounts/cash/{accountId}/transactions (Spec abgefragt
// 2026-07-06, v1.291.0). Cash-Konto-Bewegungen (Gebühren, Transfers,
// Kartenzahlungen, Guthaben-Anpassungen, ...) — cursor-paginiert.
//
// `amount` ist laut Spec ein Dezimal-STRING (kein number) — bewusst so
// übernommen, nicht in eine Zahl umgedeutet (Rundungsfallen bei Geldbeträgen).
// Detail-Objekte (card/bankTransfer/internalTransfer) werden hier nicht
// abgebildet, da die Historie-Ansicht sie nicht braucht; Zod lässt
// ungelistete Felder unangetastet durch (kein .strict()).
// -----------------------------------------------------------------------------

export const EtoroCashAccountTransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  transactionType: z.string(),
  transactionSubtype: z.string(),
  direction: z.enum(['debit', 'credit']),
  status: z.string(),
  amount: z.string(),
  currency: z.string(),
  postedAt: z.string(),
  counterparty: z
    .object({
      name: z.string().optional(),
      type: z.string().optional(),
    })
    .optional(),
});

export const EtoroCashAccountTransactionsResponseSchema = z.object({
  results: z.array(EtoroCashAccountTransactionSchema),
  pagination: z.object({
    pageSize: z.number().optional(),
    nextPageToken: z.string().nullable().optional(),
    hasNext: z.boolean().optional(),
  }),
});

export type EtoroCashAccountTransaction = z.infer<typeof EtoroCashAccountTransactionSchema>;
export type EtoroCashAccountTransactionsResponse = z.infer<typeof EtoroCashAccountTransactionsResponseSchema>;

// -----------------------------------------------------------------------------
// GET /api/v1/market-data/stocks-industries (Spec abgefragt 2026-07-06,
// v1.291.0). Branchen-Namen je stocksIndustryId (siehe
// EtoroInstrumentDisplayDataSchema.stocksIndustryId oben) — Grundlage der
// Sektor-Exposure im Analyse-Tab.
// -----------------------------------------------------------------------------

export const EtoroStocksIndustrySchema = z.object({
  industryID: z.number(),
  industryName: z.string().optional(),
});

export const EtoroStocksIndustriesResponseSchema = z.object({
  stocksIndustries: z.array(EtoroStocksIndustrySchema).optional(),
});

export type EtoroStocksIndustry = z.infer<typeof EtoroStocksIndustrySchema>;
export type EtoroStocksIndustriesResponse = z.infer<typeof EtoroStocksIndustriesResponseSchema>;

// -----------------------------------------------------------------------------
// GET /api/v1/watchlists und GET /api/v1/watchlists/{watchlistId} (Spec
// abgefragt 2026-07-06, v1.291.0) — beide liefern laut Spec dieselbe Hülle
// (WatchlistsResponse: { watchlists: [...] }), auch die Einzelabfrage. Nur
// die für die Watchlists-Ansicht benötigten Felder abgebildet (kein
// avatar/svg — reine Anzeige-Metadaten, hier nicht gebraucht).
// -----------------------------------------------------------------------------

export const EtoroWatchlistItemSchema = z.object({
  itemId: z.number(),
  itemType: z.string(),
  itemRank: z.number().optional(),
  market: z
    .object({
      symbolName: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional(),
});

export const EtoroWatchlistSchema = z.object({
  watchlistId: z.string(),
  name: z.string().optional(),
  watchlistType: z.string().optional(),
  totalItems: z.number().optional(),
  isDefault: z.boolean().optional(),
  isUserSelectedDefault: z.boolean().optional(),
  watchlistRank: z.number().optional(),
  items: z.array(EtoroWatchlistItemSchema).optional(),
});

export const EtoroWatchlistsResponseSchema = z.object({
  status: z.number().optional(),
  isSucceeded: z.boolean().optional(),
  watchlists: z.array(EtoroWatchlistSchema).optional(),
});

export type EtoroWatchlistItem = z.infer<typeof EtoroWatchlistItemSchema>;
export type EtoroWatchlist = z.infer<typeof EtoroWatchlistSchema>;
export type EtoroWatchlistsResponse = z.infer<typeof EtoroWatchlistsResponseSchema>;

// -----------------------------------------------------------------------------
// GET /api/v1/price-alerts (Spec abgefragt 2026-07-06, v1.291.0). Aktive
// Kursalarme des Nutzers. `targetPrice`/`currentPrice` sind laut Spec
// Pflichtfelder (anders als bei den meisten übrigen eToro-Endpoints, die
// außer Identifikatoren nichts als required markieren) — hier bewusst
// wörtlich übernommen.
// -----------------------------------------------------------------------------

export const EtoroPriceAlertSchema = z.object({
  alertId: z.string(),
  instrumentId: z.number(),
  symbol: z.string(),
  targetPrice: z.number(),
  currentPrice: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const EtoroPriceAlertsResponseSchema = z.object({
  results: z.array(EtoroPriceAlertSchema).optional(),
});

export type EtoroPriceAlert = z.infer<typeof EtoroPriceAlertSchema>;
export type EtoroPriceAlertsResponse = z.infer<typeof EtoroPriceAlertsResponseSchema>;

// -----------------------------------------------------------------------------
// GET /api/v1/feeds/news und GET /api/v1/feeds/markets/{marketId} (Spec
// abgefragt 2026-07-06, v1.291.0) — beide liefern dieselbe Hülle
// (DiscussionsResponse). Nur die für die reine Text-Anzeige benötigten Felder
// abgebildet (kein Comment/Emotion/Attachment/Avatar — News-Tab zeigt nur
// Text, Autor, Zeitstempel und verlinkte Instrumente).
//
// SICHERHEIT: message.text wird von der Komponente ausschließlich als reiner
// Text gerendert (kein dangerouslySetInnerHTML) — nutzergenerierter Inhalt,
// daher potenzielles XSS-Ziel. Siehe EtoroNewsTab-Tests ([REGRESSION] HTML
// im Text wird nicht ausgeführt).
// -----------------------------------------------------------------------------

export const EtoroFeedUserSchema = z.object({
  id: z.string().optional(),
  username: z.string().optional(),
});

export const EtoroFeedMarketSchema = z.object({
  id: z.string().optional(),
  symbolName: z.string().optional(),
  displayName: z.string().optional(),
  internalId: z.number().optional(),
});

export const EtoroFeedPostSchema = z.object({
  id: z.string(),
  owner: EtoroFeedUserSchema.optional(),
  message: z
    .object({
      text: z.string().optional(),
    })
    .optional(),
  created: z.string().optional(),
  tags: z
    .array(
      z.object({
        market: EtoroFeedMarketSchema.optional(),
      }),
    )
    .optional(),
});

export const EtoroDiscussionSchema = z.object({
  id: z.string(),
  post: EtoroFeedPostSchema.optional(),
});

export const EtoroDiscussionsResponseSchema = z.object({
  discussions: z.array(EtoroDiscussionSchema).optional(),
});

export type EtoroFeedPost = z.infer<typeof EtoroFeedPostSchema>;
export type EtoroDiscussion = z.infer<typeof EtoroDiscussionSchema>;
export type EtoroDiscussionsResponse = z.infer<typeof EtoroDiscussionsResponseSchema>;

// -----------------------------------------------------------------------------
// GET /api/v1/market-data/search (Spec abgefragt 2026-07-06, v1.291.0) —
// Backlog-Extra "Instrument-Suche". Nur die für eine einfache Suchliste
// benötigten Felder abgebildet (die reale Instrument-Antwort hat >60 Felder).
// -----------------------------------------------------------------------------

export const EtoroInstrumentSearchResultSchema = z.object({
  instrumentId: z.number(),
  displayname: z.string().optional(),
  internalSymbolFull: z.string().optional(),
  currentRate: z.number().optional(),
  dailyPriceChange: z.number().optional(),
});

export const EtoroInstrumentSearchResponseSchema = z.object({
  page: z.number().optional(),
  pageSize: z.number().optional(),
  totalItems: z.number().optional(),
  items: z.array(EtoroInstrumentSearchResultSchema).optional(),
});

export type EtoroInstrumentSearchResult = z.infer<typeof EtoroInstrumentSearchResultSchema>;
export type EtoroInstrumentSearchResponse = z.infer<typeof EtoroInstrumentSearchResponseSchema>;

// -----------------------------------------------------------------------------
// GET /api/v1/curated-lists (Spec abgefragt 2026-07-06, v1.291.0) —
// Backlog-Extra "Empfehlungen/kuratierte Listen".
// -----------------------------------------------------------------------------

export const EtoroCuratedListItemSchema = z.object({
  instrumentId: z.number(),
});

export const EtoroCuratedListSchema = z.object({
  uuid: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  items: z.array(EtoroCuratedListItemSchema).optional(),
});

export const EtoroCuratedListsResponseSchema = z.object({
  curatedLists: z.array(EtoroCuratedListSchema).optional(),
});

export type EtoroCuratedList = z.infer<typeof EtoroCuratedListSchema>;
export type EtoroCuratedListsResponse = z.infer<typeof EtoroCuratedListsResponseSchema>;

// -----------------------------------------------------------------------------
// GET /api/v1/market-data/instruments/{id}/history/candles/{direction}/
// {interval}/{candlesCount} (Spec abgefragt 2026-07-06, v1.291.0) —
// Backlog-Extra "Candles-Chart je Instrument". Antwortform laut Live-Beispiel:
// { interval, candles: [{ instrumentId, candles: [...], rangeOpen, ... }] } —
// eine verschachtelte Hülle je angefragtem Instrument (hier immer genau eins).
// -----------------------------------------------------------------------------

export const EtoroCandleSchema = z.object({
  fromDate: z.string(),
  open: z.number().optional(),
  high: z.number().optional(),
  low: z.number().optional(),
  close: z.number().optional(),
  volume: z.number().optional(),
});

export const EtoroInstrumentCandlesSchema = z.object({
  instrumentId: z.number().optional(),
  candles: z.array(EtoroCandleSchema).optional(),
});

export const EtoroCandlesResponseSchema = z.object({
  interval: z.string().optional(),
  candles: z.array(EtoroInstrumentCandlesSchema).optional(),
});

export type EtoroCandle = z.infer<typeof EtoroCandleSchema>;
export type EtoroCandlesResponse = z.infer<typeof EtoroCandlesResponseSchema>;

// -----------------------------------------------------------------------------
// GET /api/v1/user-info/people (Spec abgefragt 2026-07-06, v1.291.0) —
// Backlog-Extra "Öffentliche Trader-Profile". Nur die für eine einfache
// Profilkarte benötigten Felder (kein customerRestrictions/gdprInfo — interne
// Compliance-Daten, hier nicht relevant).
// -----------------------------------------------------------------------------

export const EtoroPublicUserAvatarSchema = z.object({
  url: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const EtoroPublicUserBioSchema = z.object({
  aboutMe: z.string().nullable().optional(),
  aboutMeShort: z.string().nullable().optional(),
});

export const EtoroPublicUserSchema = z.object({
  gcid: z.number().optional(),
  username: z.string(),
  isVerified: z.boolean().optional(),
  verificationLevel: z.number().optional(),
  userBio: EtoroPublicUserBioSchema.optional(),
  avatars: z.array(EtoroPublicUserAvatarSchema).optional(),
});

export const EtoroPublicUserInfoResponseSchema = z.object({
  users: z.array(EtoroPublicUserSchema).optional(),
});

export type EtoroPublicUser = z.infer<typeof EtoroPublicUserSchema>;
export type EtoroPublicUserInfoResponse = z.infer<typeof EtoroPublicUserInfoResponseSchema>;
