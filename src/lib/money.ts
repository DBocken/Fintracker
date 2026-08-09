/**
 * Geldbeträge intern in Cent (Integer) verarbeiten. Beträge werden in der App als
 * Float-Euro gespeichert (z. B. 12.50); für exakte Invarianten – etwa „Summe der
 * Aufteilungen entspricht exakt dem Originalbetrag“ – muss in Cent gerechnet und
 * Integer-zu-Integer verglichen werden, nie über Float-Gleichheit.
 *
 * `toMinor` ist der einzige Rundungspunkt: alle Aufrufer runden identisch, damit
 * z. B. 12.505 deterministisch zu 1251 wird statt zu 1250.
 */

import { t } from "@/i18n/serviceT";

/**
 * Branded Types für Geld (WP 5.1, DOM-1): Cent und Euro sind für den
 * Compiler ohne Brand identisch (`number`) — eine Faktor-100-Verwechslung
 * kompiliert widerspruchslos. Der Brand existiert NUR zur Compile-Zeit
 * (Intersection mit einem nie befüllten Phantom-Feld); zur Laufzeit ist ein
 * `Cents`/`EuroAmount`-Wert ein ganz normaler `number`, `JSON.stringify`,
 * Vergleiche (`===`, `toBe`) etc. verhalten sich unverändert.
 *
 * `toMinor`/`toMajor` sind die EINZIGEN Konstruktoren. Persistierte Daten
 * und zod-Schemata liefern an der Datengrenze rohen `number` — der Brand
 * wird dort bewusst NICHT erzwungen (siehe `parseAtBoundary`-Schemata), weil
 * das Persistenzformat von `Transaction.amount` laut ADR Euro-Float bleibt
 * (docs/domain-invariants.md Invariante 5) und ein Pflicht-Cast an jeder
 * Lesestelle den Brand zur Dekoration machen würde.
 */
export type Cents = number & { readonly __brand: "Cents" };
export type EuroAmount = number & { readonly __brand: "EuroAmount" };

/** Float-Euro -> Integer-Cent. Vorzeichen bleibt erhalten. */
export function toMinor(amount: number): Cents {
  // Math.round behandelt die übliche Float-Drift bei 2-Dezimal-Euro-Beträgen
  // korrekt (z. B. 19.99*100 = 1998.9999… -> 1999, 0.1+0.2 -> 30).
  return Math.round(amount * 100) as Cents;
}

/** Integer-Cent -> Float-Euro (nur für Anzeige/Export). */
export function toMajor(minor: Cents): EuroAmount {
  return (minor / 100) as EuroAmount;
}

/** Summe einer Cent-Liste (Integer). */
export function sumMinor(values: Cents[]): Cents {
  return values.reduce((acc: number, v) => acc + v, 0) as Cents;
}

/**
 * Toleranz für {@link isCentPrecise} — Einheit: Cent, nicht Euro.
 *
 * IEEE-754-Multiplikation streut auch bei einem fachlich exakten 2-Dezimal-
 * Betrag um winzige Beträge (19.99 * 100 = 1998.9999999999998; 0.1 + 0.2 = 30
 * statt exakt 30 Cent). Diese Streuung bleibt für Euro-Beträge im Alltags-
 * bis Großbetrags-Bereich (bis in den zweistelligen Millionenbereich) durch
 * `Number.EPSILON` (~2.22e-16) relativ zum Cent-Wert nach oben durch etwa
 * 1e-7 Cent begrenzt — reine Darstellungsungenauigkeit, kein fachlicher
 * Fehler. Ein tatsächlicher Sub-Cent-Betrag wie 0.005 € weicht dagegen um
 * 0.5 Cent ab: das 5-Millionen-fache dieser Toleranz. `1e-6` liegt damit
 * bequem über jeder Float-Darstellungsstreuung und bequem unter jeder
 * denkbaren halben-Cent-Ambiguität — es gibt keinen Betrag, bei dem die Wahl
 * dieser Konstante die Entscheidung "gültig vs. ungültig" beeinflusst.
 */
const CENT_PRECISION_EPSILON_CENTS = 1e-6;

/**
 * Prüft, ob ein Float-Euro-Betrag verlustfrei zu ganzzahligen Cent rundet
 * (Invariante 5, docs/domain-invariants.md: Persistenzformat bleibt
 * Euro-Float, die Validierung an fachlichen Grenzen ist cent-genau). `NaN`/
 * `Infinity` gelten als nicht cent-genau.
 */
export function isCentPrecise(amount: number): boolean {
  if (!Number.isFinite(amount)) return false;
  const cents = amount * 100;
  return Math.abs(cents - Math.round(cents)) <= CENT_PRECISION_EPSILON_CENTS;
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
  if (n === null) throw new Error(t("moneyLib.invalidAmount", "Ungültiger Betrag"));
  return n;
}
