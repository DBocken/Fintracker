/**
 * WP 5.3 (KOMP-5) — Untersuchung der 17× `as Error | null` in
 * `TradingDashboard.tsx`.
 *
 * TanStack Query v5 registriert `Error` als Standard-Fehlertyp
 * (`DefaultError`) — `error` aus `useQuery({...})` ist ohne jeden Generic
 * und ohne jeden Cast bereits `Error | null`. 16 der 17 Fundstellen waren
 * deshalb tote Casts: sie behaupteten einen Typ, den TypeScript schon lieferte,
 * und hätten einen echten Typfehler (z.B. eine andere Query, die `unknown`
 * liefert) stillschweigend überdeckt statt ihn zu zeigen — ein Cast prüft
 * nichts, er behauptet nur.
 *
 * Die einzige ECHTE Lücke steckt nicht in `useQuery`, sondern in
 * `Array.prototype.find`: `positionsFeedQueries.find((q) => q.error)?.error`
 * ergibt `Error | null | undefined`, weil `.find()` bei keinem Treffer
 * `undefined` liefert. Das ist kein fehlender Cast, sondern ein echter
 * dritter Fall, den `firstQueryError` normalisiert.
 */

/** Ausschnitt eines `UseQueryResult`/`UseQueriesResult`-Eintrags — nur das Feld, das gebraucht wird. */
export interface QueryErrorSource {
  error: Error | null;
}

/**
 * Der erste tatsächliche Fehler unter mehreren Abfrage-Ergebnissen
 * (`useQueries`) — oder `null`, wenn keine Abfrage fehlgeschlagen ist.
 * Liefert nie `undefined`, anders als das rohe `.find(...)?.error`.
 */
export function firstQueryError(results: readonly QueryErrorSource[]): Error | null {
  return results.find((r) => r.error)?.error ?? null;
}
