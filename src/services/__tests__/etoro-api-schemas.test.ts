import { describe, it, expect } from 'vitest';
import {
  EtoroInstrumentsResponseSchema,
  EtoroLiveRatesResponseSchema,
  EtoroAggregatePortfolioResponseSchema,
  EtoroTradeHistoryResponseSchema,
  EtoroPnlResponseSchema,
  EtoroBalancesResponseSchema,
  EtoroHistoricalBalancesResponseSchema,
  EtoroCashAccountTransactionsResponseSchema,
  EtoroStocksIndustriesResponseSchema,
} from '../etoro-api-schemas';

// -----------------------------------------------------------------------------
// Contract-Tests: prüfen die Zod-Schemas gegen die REALE eToro-API-Antwort
// (wörtlich aus der Live-OpenAPI-Spec kopiert, v1.291.0, abgefragt über den
// eToro-MCP-Connector — nicht aus dem Gedächtnis oder einer Dokumentation
// rekonstruiert).
//
// Zweck: Issue #195 entstand, weil ein Unit-Test grün war, obwohl sein Mock
// eine erfundene Antwortstruktur hatte ({ instruments: [...] } statt der
// echten { instrumentDisplayDatas: [...] }). Diese Datei verhindert, dass
// sich das wiederholt: Sie prüft das Schema gegen ein Beispiel, das direkt
// dem realen `InstrumentsResponse`-Schema der Live-Spec entspricht. Ändert
// sich die reale API, muss dieser Test bewusst (mit neuem Spec-Abruf)
// angepasst werden — er kann nicht versehentlich grün bleiben.
// -----------------------------------------------------------------------------

describe('EtoroInstrumentsResponseSchema (Vertrag gegen Live-API v1.291.0)', () => {
  it('sollte die reale API-Hülle { instrumentDisplayDatas: [...] } akzeptieren', () => {
    // Struktur 1:1 aus der Live-Spec (GET /api/v1/market-data/instruments,
    // Schema InstrumentsResponse) — nicht handgeschrieben geraten.
    const realApiResponse = {
      instrumentDisplayDatas: [
        {
          instrumentID: 1001,
          instrumentDisplayName: 'Apple Inc.',
          instrumentTypeID: 5,
          exchangeID: 4,
          symbolFull: 'AAPL',
          stocksIndustryId: 12,
          priceSource: 'Nasdaq',
          hasExpirationDate: false,
          isInternalInstrument: false,
          images: [{ instrumentID: 1001, width: 32, height: 32, uri: 'https://example.test/aapl.png', backgroundColor: '#fff', textColor: '#000' }],
        },
      ],
    };

    const result = EtoroInstrumentsResponseSchema.safeParse(realApiResponse);
    expect(result.success).toBe(true);
  });

  it('[REGRESSION] sollte die frühere Fehlannahme { instruments: [...] } ablehnen', () => {
    // Das war die falsche Hülle, gegen die etoro-service.ts vor #195 geprüft
    // hat — dieser Test dokumentiert, dass sie NICHT dem echten Schema
        // entspricht (verhindert Rückfall in die alte Fehlannahme).
    const wrongShape = {
      instruments: [{ instrumentId: 1001, internalSymbolFull: 'AAPL', displayname: 'Apple Inc.' }],
    };

    const result = EtoroInstrumentsResponseSchema.safeParse(wrongShape);
    expect(result.success).toBe(false);
  });

  it('[REGRESSION] sollte ein nacktes Array ablehnen (nur die benannte Hülle ist gültig)', () => {
    const bareArray = [{ instrumentID: 1001, symbolFull: 'AAPL' }];
    const result = EtoroInstrumentsResponseSchema.safeParse(bareArray);
    expect(result.success).toBe(false);
  });

  it('sollte fehlende Pflichtfelder (instrumentID, symbolFull) ablehnen', () => {
    const incomplete = { instrumentDisplayDatas: [{ instrumentDisplayName: 'Apple Inc.' }] };
    const result = EtoroInstrumentsResponseSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });
});

describe('EtoroLiveRatesResponseSchema (Vertrag gegen Live-API v1.291.0)', () => {
  it('sollte die reale API-Hülle { rates: [...] } akzeptieren', () => {
    // Struktur 1:1 aus der Live-Spec (GET /api/v1/market-data/instruments/rates,
    // Schema LiveRatesResponse) — inkl. der zusätzlichen (teils "Obsolete"
    // markierten) Felder, die die echte API mitliefert.
    const realApiResponse = {
      rates: [
        {
          instrumentID: 1001,
          ask: 160.5,
          bid: 160.1,
          lastExecution: 160.3,
          conversionRateAsk: 1,
          conversionRateBid: 1,
          date: '2026-07-05T15:00:00Z',
          priceRateID: 42,
        },
      ],
    };

    const result = EtoroLiveRatesResponseSchema.safeParse(realApiResponse);
    expect(result.success).toBe(true);
  });

  it('sollte instrumentID als einziges Pflichtfeld verlangen (illiquide Assets liefern evtl. nicht alle Preise)', () => {
    const minimal = { rates: [{ instrumentID: 1001 }] };
    expect(EtoroLiveRatesResponseSchema.safeParse(minimal).success).toBe(true);
  });

  it('[REGRESSION] sollte ein nacktes Array ablehnen (nur die benannte Hülle ist gültig)', () => {
    const bareArray = [{ instrumentID: 1001, bid: 100 }];
    expect(EtoroLiveRatesResponseSchema.safeParse(bareArray).success).toBe(false);
  });

  it('sollte fehlendes instrumentID ablehnen', () => {
    const invalid = { rates: [{ bid: 100 }] };
    expect(EtoroLiveRatesResponseSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('EtoroAggregatePortfolioResponseSchema (Vertrag gegen Live-API v1.291.0)', () => {
  it('sollte den realen Konto-Snapshot (accountTotals, instrumentAggregates, mirrors) akzeptieren', () => {
    // Struktur 1:1 aus der Live-Spec (GET /trading/info/aggregate-portfolio,
    // Beispiel-Response), inkl. verschachtelter mirrors.instrumentAggregates.
    const realApiResponse = {
      cid: 4498,
      timestamp: '2026-05-26T15:24:25.267Z',
      accountCurrency: 'USD',
      accountTotals: {
        accountAvailableCash: 4320.84,
        accountFrozenCash: 0,
        accountCurrentPnl: -300.35,
        accountTotalValue: 5154.48,
        accountTotalUsedMargin: 1133.99,
        accountBalance: 4320.84,
      },
      instrumentAggregates: [
        {
          instrumentId: 100000,
          assetCurrency: 'USD',
          totalMarginAccountCurrency: 849.86,
          totalFees: 0,
          pnlAssetCurrency: -225.3,
          netUnits: 0.008076,
          netCurrentExposureAccountCurrency: 624.57,
          avgLeverage: 1,
          avgOpenRate: 105233.5041183754,
        },
      ],
      mirrors: [
        {
          mirrorId: 1869651,
          mirrorAvailableCash: 0.04,
          mirrorDepositTotal: 290,
          mirrorWithdrawalTotal: 0,
          mirrorClosedPositionsPnl: -0.26,
          mirrorTotals: {
            mirrorNetFunding: 290,
            mirrorPositionsPnl: -75.05,
            mirrorLiquidationValue: 209.08,
            mirrorPositionsPnlPercent: -0.35,
            mirrorValuePercent: 4.06,
            mirrorActiveMargin: 284.13,
          },
          instrumentAggregates: [],
        },
      ],
    };

    const result = EtoroAggregatePortfolioResponseSchema.safeParse(realApiResponse);
    expect(result.success).toBe(true);
  });

  it('sollte pnlAssetCurrency als null akzeptieren (Spec markiert es nullable)', () => {
    const withNullPnl = {
      instrumentAggregates: [{ instrumentId: 1001, pnlAssetCurrency: null }],
    };
    expect(EtoroAggregatePortfolioResponseSchema.safeParse(withNullPnl).success).toBe(true);
  });

  it('sollte eine leere Antwort {} akzeptieren (alle Top-Level-Felder optional)', () => {
    expect(EtoroAggregatePortfolioResponseSchema.safeParse({}).success).toBe(true);
  });

  it('sollte instrumentId als Pflichtfeld je Aggregat verlangen', () => {
    const missingId = { instrumentAggregates: [{ assetCurrency: 'USD' }] };
    expect(EtoroAggregatePortfolioResponseSchema.safeParse(missingId).success).toBe(false);
  });

  it('sollte mirrorId als Pflichtfeld je Mirror verlangen', () => {
    const missingMirrorId = { mirrors: [{ mirrorDepositTotal: 100 }] };
    expect(EtoroAggregatePortfolioResponseSchema.safeParse(missingMirrorId).success).toBe(false);
  });
});

describe('EtoroTradeHistoryResponseSchema (Vertrag gegen Live-API v1.291.0)', () => {
  it('sollte das reale nackte Array geschlossener Trades akzeptieren', () => {
    // Struktur 1:1 aus der Live-Spec (GET /trading/info/trade/history,
    // 200-Antwort: type "array" von Trade-Objekten — keine benannte Hülle,
    // anders als instruments/rates/aggregate-portfolio.
    const realApiResponse = [
      {
        netProfit: 42.5,
        closeRate: 190.2,
        closeTimestamp: '2026-06-01T10:00:00Z',
        positionId: 987654321,
        instrumentId: 1001,
        isBuy: true,
        leverage: 1,
        openRate: 180.0,
        openTimestamp: '2026-05-01T09:00:00Z',
        stopLossRate: 170.0,
        takeProfitRate: 200.0,
        trailingStopLoss: false,
        orderId: 555,
        socialTradeId: 0,
        parentPositionId: 0,
        investment: 500,
        initialInvestment: 500,
        fees: 1.25,
        units: 2.5,
      },
    ];

    const result = EtoroTradeHistoryResponseSchema.safeParse(realApiResponse);
    expect(result.success).toBe(true);
  });

  it('[REGRESSION] sollte eine benannte Hülle ({ trades: [...] }) ablehnen — die reale Antwort ist ein nacktes Array', () => {
    const wrongShape = { trades: [{ positionId: 1, instrumentId: 1001 }] };
    expect(EtoroTradeHistoryResponseSchema.safeParse(wrongShape).success).toBe(false);
  });

  it('sollte positionId und instrumentId als Pflichtfelder verlangen', () => {
    const missingIds = [{ netProfit: 10 }];
    expect(EtoroTradeHistoryResponseSchema.safeParse(missingIds).success).toBe(false);
  });

  it('sollte ein leeres Array akzeptieren (Konto ohne geschlossene Trades)', () => {
    expect(EtoroTradeHistoryResponseSchema.safeParse([]).success).toBe(true);
  });
});

describe('EtoroPnlResponseSchema (Vertrag gegen Live-API v1.291.0)', () => {
  it('sollte die reale Hülle { clientPortfolio: {...} } akzeptieren', () => {
    // Ausschnitt 1:1 aus der Live-Spec (GET /trading/info/real/pnl,
    // Schema PortfolioResponseWithPnl → ClientPortfolio → Mirror). Die reale
    // Antwort enthält daneben u. a. positions/orders — hier bewusst nur der
    // für die Historie-Ansicht benötigte Ausschnitt geprüft.
    const realApiResponse = {
      clientPortfolio: {
        credit: 10000.5,
        bonusCredit: 500.0,
        unrealizedPnL: 251.0,
        mirrors: [
          {
            mirrorID: 1,
            closedPositionsNetProfit: 350.75,
            parentUsername: 'parent_user',
          },
        ],
      },
    };

    const result = EtoroPnlResponseSchema.safeParse(realApiResponse);
    expect(result.success).toBe(true);
  });

  it('sollte eine leere Antwort {} akzeptieren (clientPortfolio optional)', () => {
    expect(EtoroPnlResponseSchema.safeParse({}).success).toBe(true);
  });

  it('sollte mirrorID als Pflichtfeld je Mirror verlangen', () => {
    const missingId = { clientPortfolio: { mirrors: [{ closedPositionsNetProfit: 10 }] } };
    expect(EtoroPnlResponseSchema.safeParse(missingId).success).toBe(false);
  });
});

describe('EtoroBalancesResponseSchema (Vertrag gegen Live-API v1.291.0)', () => {
  it('sollte die reale Antwort (GetBalancesResponse) akzeptieren', () => {
    const realApiResponse = {
      gcid: 4498,
      totalBalance: 5654.48,
      displayCurrency: 'USD',
      balances: [
        { accountId: 'f0995efc-25a1-465e-bec3-d309aaf00ede', accountType: 'Cash', balance: 500, currency: 'USD', displayBalance: 500 },
        { accountId: null, accountType: 'Trading', balance: 5154.48, currency: 'USD', displayBalance: 5154.48 },
      ],
    };
    expect(EtoroBalancesResponseSchema.safeParse(realApiResponse).success).toBe(true);
  });

  it('sollte accountType als Pflichtfeld je Konto verlangen', () => {
    const missingType = { balances: [{ accountId: 'x' }] };
    expect(EtoroBalancesResponseSchema.safeParse(missingType).success).toBe(false);
  });

  it('sollte eine leere Antwort {} akzeptieren', () => {
    expect(EtoroBalancesResponseSchema.safeParse({}).success).toBe(true);
  });
});

describe('EtoroHistoricalBalancesResponseSchema (Vertrag gegen Live-API v1.291.0)', () => {
  it('sollte die reale Antwort (GetHistoricalBalancesResponse) mit snapshots akzeptieren', () => {
    const realApiResponse = {
      gcid: 4498,
      displayCurrency: 'USD',
      fromDate: '2026-06-01',
      toDate: '2026-07-01',
      snapshots: [
        { date: '2026-06-01', totalBalance: 5000, displayTotalBalance: 5000, totalCash: 400, totalInvestedAmount: 4600, totalPnl: 0 },
        { date: '2026-06-02', totalBalance: 5100, displayTotalBalance: 5100 },
      ],
    };
    expect(EtoroHistoricalBalancesResponseSchema.safeParse(realApiResponse).success).toBe(true);
  });

  it('sollte date als Pflichtfeld je Snapshot verlangen', () => {
    const missingDate = { snapshots: [{ totalBalance: 100 }] };
    expect(EtoroHistoricalBalancesResponseSchema.safeParse(missingDate).success).toBe(false);
  });

  it('sollte eine leere Antwort {} akzeptieren', () => {
    expect(EtoroHistoricalBalancesResponseSchema.safeParse({}).success).toBe(true);
  });
});

describe('EtoroCashAccountTransactionsResponseSchema (Vertrag gegen Live-API v1.291.0)', () => {
  it('sollte die reale Antwort (CashAccountTransactionsResponse, amount als String) akzeptieren', () => {
    // Struktur 1:1 aus der Live-Spec — inkl. amount als Dezimal-STRING, nicht number.
    const realApiResponse = {
      results: [
        {
          id: '12345',
          accountId: 'f0995efc-25a1-465e-bec3-d309aaf00ede',
          transactionType: 'card',
          transactionSubtype: 'cardPayment',
          direction: 'debit',
          status: 'settled',
          amount: '100.00',
          currency: 'USD',
          originalAmount: '90.00',
          originalCurrency: 'EUR',
          conversionRate: '1.1111',
          postedAt: '2026-05-03T10:16:12Z',
          counterparty: { name: 'Acme Store', type: 'merchant' },
          cardTransactionDetails: { cardId: '101', merchantName: 'Acme Store', country: 'US', authorizationStatus: 'normal' },
          bankTransferTransactionDetails: null,
          internalTransferTransactionDetails: null,
        },
      ],
      pagination: { pageSize: 50, nextPageToken: 'eyJsYXN0SWQiOjEyMzk1fQ==', hasNext: true },
    };
    expect(EtoroCashAccountTransactionsResponseSchema.safeParse(realApiResponse).success).toBe(true);
  });

  it('[REGRESSION] sollte amount als String belassen, nicht in eine Zahl umwandeln', () => {
    const minimal = {
      results: [
        {
          id: '1',
          accountId: 'acc-1',
          transactionType: 'balanceAdjustment',
          transactionSubtype: 'fee',
          direction: 'debit',
          status: 'settled',
          amount: '2.50',
          currency: 'USD',
          postedAt: '2026-06-01T00:00:00Z',
        },
      ],
      pagination: { pageSize: 50, hasNext: false },
    };
    const result = EtoroCashAccountTransactionsResponseSchema.parse(minimal);
    expect(result.results[0].amount).toBe('2.50');
    expect(typeof result.results[0].amount).toBe('string');
  });

  it('sollte die Pflichtfelder je Transaktion verlangen', () => {
    const missingFields = { results: [{ id: '1' }], pagination: { pageSize: 50, hasNext: false } };
    expect(EtoroCashAccountTransactionsResponseSchema.safeParse(missingFields).success).toBe(false);
  });

  it('sollte ein leeres results-Array akzeptieren', () => {
    const empty = { results: [], pagination: { pageSize: 50, hasNext: false } };
    expect(EtoroCashAccountTransactionsResponseSchema.safeParse(empty).success).toBe(true);
  });
});

describe('EtoroStocksIndustriesResponseSchema (Vertrag gegen Live-API v1.291.0)', () => {
  it('sollte die reale Antwort (StocksIndustriesResponse) akzeptieren', () => {
    const realApiResponse = {
      stocksIndustries: [
        { industryID: 12, industryName: 'Technology' },
        { industryID: 7, industryName: 'Healthcare' },
      ],
    };
    expect(EtoroStocksIndustriesResponseSchema.safeParse(realApiResponse).success).toBe(true);
  });

  it('sollte industryID als Pflichtfeld je Branche verlangen', () => {
    const missingId = { stocksIndustries: [{ industryName: 'Technology' }] };
    expect(EtoroStocksIndustriesResponseSchema.safeParse(missingId).success).toBe(false);
  });

  it('sollte eine leere Antwort {} akzeptieren', () => {
    expect(EtoroStocksIndustriesResponseSchema.safeParse({}).success).toBe(true);
  });
});
