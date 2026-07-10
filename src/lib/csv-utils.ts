/**
 * CSV-Helfer mit Härtung gegen Formel-Injection (F-MONEY-2) und RFC-4180-Quoting.
 * Zentral extrahiert, damit alle CSV-Exporte (Transaktionen, Steuer) dieselbe
 * sichere Zell-Kodierung verwenden.
 */

/**
 * Kodiert eine Zelle sicher:
 * - Rein numerische Zellen (auch dt. „-12,34") werden NICHT präfigiert, sonst
 *   würde Excel (negative) Beträge als Text lesen und Summen verfälschen.
 * - Zellen, die mit =,+,-,@,Tab oder CR beginnen, werden mit ' neutralisiert
 *   (Formel-Injection).
 * - Trennzeichen/Quote/Zeilenumbruch → in Anführungszeichen setzen, " verdoppeln.
 */
export function escapeCsvCell(value: unknown): string {
  let s = String(value ?? '');
  const isNumeric = /^-?\d+(?:[.,]\d+)?$/.test(s);
  if (!isNumeric && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Baut eine Semikolon-getrennte CSV-Zeile aus bereits nicht-kodierten Werten. */
export function toCsvRow(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(';');
}
