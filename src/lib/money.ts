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

/**
 * Deutsche Geldbetrags-Eingabe -> Float-Euro, oder `null` bei ungültiger Eingabe.
 *
 * Der einzige gemeinsame Parser für UI-Eingaben, CSV und programmatische Pfade.
 * Deutsches Format nutzt Komma als Dezimal- und Punkt als Tausendertrenner
 * (z. B. "1.234,56" = 1234.56). Kritisch: Ist ein Komma vorhanden, werden zuerst
 * die Tausenderpunkte entfernt — sonst würde "1.200" fälschlich als 1,20 gelesen.
 * Ohne Komma bleibt ein einzelner Punkt als Dezimaltrenner erhalten ("12.50").
 */
export function parseGermanNumber(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;

  let s = String(input)
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");
  if (!s || s === "-" || s === "." || s === ",") return null;

  if (s.includes(",")) {
    // Komma = Dezimaltrenner -> Tausenderpunkte entfernen, Komma -> Punkt.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // Ohne Komma: Punkt-Dreiergruppierung ist deutscher Tausendertrenner
    // ("1.200" = 1200, "1.234.567" = 1234567). Ein Punkt mit anderer
    // Stellenzahl ("12.50") bleibt Dezimaltrenner.
    s = s.replace(/\./g, "");
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Wie `parseGermanNumber`, wirft aber bei ungültiger Eingabe. Für fachliche
 * Grenzen (Formulare, Persistenz), an denen ein ungültiger Betrag nicht still
 * als 0 durchrutschen darf.
 */
export function parseEuroInput(input: string | number | null | undefined): number {
  const n = parseGermanNumber(input);
  if (n === null) throw new Error("Ungültiger Betrag");
  return n;
}
