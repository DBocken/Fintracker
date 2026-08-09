import { describe, it, expect } from "vitest";
import { firstQueryError } from "../query-results";

/**
 * WP 5.3 (KOMP-5) — `TradingDashboard.tsx` castete 17× `as Error | null`.
 * Untersucht: TanStack Query v5 hat `Error` als Standard-Fehlertyp — `error`
 * aus `useQuery()` ist ohne jeden Cast bereits `Error | null` (16 der 17
 * Fundstellen waren toter Code, siehe Bericht). Die einzige ECHTE Lücke war
 * `positionsFeedQueries.find((q) => q.error)?.error` in `use-etoro-account.ts`:
 * `.find()` liefert bei keinem Treffer `undefined`, nicht `null` — das ist ein
 * Typ, kein fehlender Cast. `firstQueryError` normalisiert genau das.
 */
describe("firstQueryError", () => {
  it("sollte null liefern, wenn keine Abfrage einen Fehler hat", () => {
    const results = [{ error: null }, { error: null }] as const;
    expect(firstQueryError(results)).toBeNull();
  });

  it("sollte den ersten tatsächlichen Fehler liefern, nicht undefined", () => {
    const boom = new Error("kaputt");
    const results = [{ error: null }, { error: boom }, { error: null }];
    expect(firstQueryError(results)).toBe(boom);
  });

  it("sollte bei einer leeren Liste null liefern (nicht undefined)", () => {
    // Genau der Fall, der vorher `Error | null | undefined` ergab.
    expect(firstQueryError([])).toBeNull();
  });
});
