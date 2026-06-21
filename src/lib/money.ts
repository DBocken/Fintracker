/**
 * Geldbeträge intern in Cent (Integer) verarbeiten. Beträge werden in der App als
 * Float-Euro gespeichert (z. B. 12.50); für exakte Invarianten – etwa „Summe der
 * Aufteilungen entspricht exakt dem Originalbetrag“ – muss in Cent gerechnet und
 * Integer-zu-Integer verglichen werden, nie über Float-Gleichheit.
 *
 * `toMinor` ist der einzige Rundungspunkt: alle Aufrufer runden identisch, damit
 * z. B. 12.505 deterministisch zu 1251 wird statt zu 1250.
 */

/** Float-Euro -> Integer-Cent. Vorzeichen bleibt erhalten. */
export function toMinor(amount: number): number {
  // Math.round behandelt die übliche Float-Drift bei 2-Dezimal-Euro-Beträgen
  // korrekt (z. B. 19.99*100 = 1998.9999… -> 1999, 0.1+0.2 -> 30).
  return Math.round(amount * 100);
}

/** Integer-Cent -> Float-Euro (nur für Anzeige/Export). */
export function toMajor(minor: number): number {
  return minor / 100;
}

/** Summe einer Cent-Liste (Integer). */
export function sumMinor(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
