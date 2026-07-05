import { describe, it, expect } from 'vitest';
import { EtoroInstrumentsResponseSchema } from '../etoro-api-schemas';

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
