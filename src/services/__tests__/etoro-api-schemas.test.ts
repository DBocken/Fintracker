import { describe, it, expect } from 'vitest';
import {
  EtoroInstrumentsResponseSchema,
  EtoroLiveRatesResponseSchema,
  EtoroAggregatePortfolioResponseSchema,
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
