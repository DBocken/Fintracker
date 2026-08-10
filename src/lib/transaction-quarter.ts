/**
 * Quartalszuordnung für die Chunk-Ablage der Transaktionen (PERF-1, WP 4.1b).
 *
 * Reine Funktion ohne I/O — gehört deshalb nach `src/lib/`, nicht in den
 * Chunk-Speicher-Service (AGENTS.md §3, "Wohin ein Typ gehört": "Reine
 * Funktion ohne I/O ... auch wenn nur ein Service sie heute ruft").
 *
 * Vorgabe aus `docs/architecture/transaction-storage-chunks.md`: Die
 * Zuordnung ergibt sich aus `Transaction.date` (ISO, `YYYY-MM-DD`) — Jahr aus
 * den ersten vier Zeichen, Quartal aus dem Monat. Buchungen ohne verwertbares
 * Datum kommen in den festen Chunk `unknown`; sie verschwinden damit nicht,
 * und die Zuordnung hängt nicht von einer Zeitzonenrechnung ab (reines
 * String-Parsing, keine `Date`-Konstruktion).
 */

/** Fester Chunk für Buchungen ohne verwertbares Datum (ADR, s.o.). */
export const UNKNOWN_QUARTER_KEY = 'unknown'

export type QuarterKey = string

// `YYYY-MM-DD...` — nur der Datumsanteil wird geprüft; ein evtl. angehängter
// Zeitanteil (ISO-Timestamp) ist für die Quartalszuordnung irrelevant.
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-\d{2}/

/**
 * Bildet ein `Transaction.date` (ISO `YYYY-MM-DD`) auf einen Quartals-Chunk-
 * Schlüssel (`YYYY-Qn`) ab. Ein leeres, fehlendes oder syntaktisch kaputtes
 * Datum sowie ein Monat außerhalb 01–12 ergibt `UNKNOWN_QUARTER_KEY` — nie
 * einen Wurf, denn eine defekte Buchung darf beim Chunking nicht verschwinden.
 */
export function quarterKeyForDate(date: string | null | undefined): QuarterKey {
  if (!date) return UNKNOWN_QUARTER_KEY

  const match = ISO_DATE_PATTERN.exec(date)
  if (!match) return UNKNOWN_QUARTER_KEY

  const year = match[1]
  const month = Number(match[2])
  if (!Number.isInteger(month) || month < 1 || month > 12) return UNKNOWN_QUARTER_KEY

  const quarter = Math.ceil(month / 3)
  return `${year}-Q${quarter}`
}
