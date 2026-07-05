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
