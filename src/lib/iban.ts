/**
 * IBAN-Normalisierung — reine Zeichenkettenarbeit ohne I/O.
 *
 * Lag zuvor im `transfer-service`, wodurch `lib/merchant-fingerprint.ts`
 * entgegen der Schichtrichtung nach oben importieren musste (AGENTS.md §3).
 */

/** Vereinheitlicht eine IBAN (Leerzeichen weg, Großbuchstaben) für den Vergleich. */
export function normalizeIban(iban?: string | null): string | null {
  if (!iban) return null;
  const normalized = iban.replace(/\s+/g, '').toUpperCase();
  return normalized.length > 0 ? normalized : null;
}
