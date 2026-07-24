import { parseGermanNumber, toMinor } from './money';

/**
 * Vorzeichen-Regeln für Split-Buchungen (Aufteilung einer Buchung auf mehrere
 * Kategorien).
 *
 * Grundsatz: Das Vorzeichen einer Aufteilung gehört zur Buchung, nicht zur
 * Eingabe. Wer eine Ausgabe von 50 € auf „Lebensmittel" und „Kleidung"
 * aufteilt, tippt Beträge (12,99) — kein Minus. Das hält die
 * Vorzeichen-Invariante (F-MONEY-5: jede Aufteilung hat dasselbe Vorzeichen
 * wie die Originalbuchung) eingabe-unabhängig ein.
 *
 * Alle Beträge in Integer-Cent (`@/lib/money`), nie als Float verglichen.
 */

/** Vorzeichen, das jede Aufteilung dieser Buchung tragen muss (0 € ⇒ positiv). */
export function allocationSign(totalMinor: number): 1 | -1 {
  return totalMinor < 0 ? -1 : 1;
}

/**
 * Eingabe einer Split-Zeile → vorzeichenbehafteter Cent-Betrag.
 *
 * Der Betrag wird als Magnitude gelesen (ein getipptes Minus wird bewusst
 * ignoriert) und bekommt das Vorzeichen der Buchung. Leere oder ungültige
 * Eingaben ergeben 0 — eine solche Zeile zählt schlicht nicht mit, statt die
 * Aufteilung mit `NaN` zu vergiften.
 */
export function parseSplitAmount(input: string, totalMinor: number): number {
  const parsed = parseGermanNumber(input);
  if (parsed === null) return 0;
  return allocationSign(totalMinor) * Math.abs(toMinor(parsed));
}

/**
 * Noch nicht zugewiesener Rest in Cent, gemessen in Richtung der Buchung:
 * `> 0` = noch offen, `< 0` = zu viel zugewiesen, `0` = exakt aufgeteilt.
 *
 * Bewusst richtungsnormiert statt roh `total - allocated`: bei Ausgaben (dem
 * Normalfall) ist der rohe Rest negativ, obwohl noch etwas OFFEN ist — die
 * Statusbeschriftung „offen/zu viel" wäre damit vertauscht.
 */
export function openSplitMinor(totalMinor: number, allocatedMinor: number): number {
  const open = allocationSign(totalMinor) * (totalMinor - allocatedMinor);
  // `-1 * 0` ergibt `-0` — normalisieren, damit „exakt aufgeteilt" überall
  // identisch aussieht (Object.is-Vergleiche, Formatierung als „-0,00 €").
  return open === 0 ? 0 : open;
}

/** Cent → Eingabe-Text der Split-Zeile: deutsche Magnitude ohne Vorzeichen. */
export function formatSplitAmountInput(minor: number): string {
  return (Math.abs(minor) / 100).toFixed(2).replace('.', ',');
}
