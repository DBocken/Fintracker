/**
 * Kernlogik des Dezimal-Eingabe-Wächters (AGENTS.md §8).
 *
 * `<input type="number">` ist für deutsche Dezimaleingaben unbrauchbar. Das ist
 * gemessen, nicht vermutet — Chromium mit Locale `de-DE` liefert:
 *
 *   getippt „12,50"    -> .value "1250"     (Faktor 100 zu viel)
 *   getippt „1.200"    -> .value "1.200"    (parseFloat: 1,2)
 *   getippt „1.234,56" -> .value "1.23456"
 *   getippt „5,5" %    -> gespeichert 55 %
 *
 * Der Browser verstümmelt die Eingabe, BEVOR irgendein Parser sie sieht — kein
 * `parseGermanNumber` repariert das danach. Deshalb prüft dieser Wächter nicht
 * den Parser, sondern das Feld.
 *
 * Getrennt vom Runner, damit die Logik ohne Dateisystem testbar ist — dieselbe
 * Aufteilung wie bei `layers-core.mjs` und `test-structure-core.mjs`.
 */

/**
 * Wortschatz für „hier steht eine Dezimalzahl".
 *
 * Bewusst eng: Ein Wächter mit Fehlalarmen wird abgeschaltet statt befolgt.
 * Ganzzahlige Felder (Anzahl, Tag im Monat, Jahr, Monate) sind mit
 * `type="number"` völlig in Ordnung und stehen deshalb nicht hier.
 */
const DECIMAL_HINTS = [
  'amount', 'betrag', 'balance', 'saldo', 'price', 'preis', 'kurs',
  'payment', 'rate', 'zins', 'interest', 'budget', 'cost', 'kosten',
  'euro', 'money', 'geld', 'value', 'wert', 'buffer', 'puffer',
  'income', 'einkommen', 'expense', 'ausgabe', 'tilgung', 'quantity',
];

/** Attribute, deren Inhalt verrät, worum es in dem Feld geht. */
const NAMING_ATTRS = /(?:id|name|htmlFor|aria-label|placeholder|value)=\{?["'{]?([^"'}\n]*)/gi;

/**
 * Findet `type="number"`-Felder, die nach einer Dezimalzahl aussehen.
 *
 * @param relPath repo-relativer Pfad (nur für die Meldung)
 * @param source  Dateiinhalt
 * @returns Liste der Fundstellen mit Zeilennummer und dem auslösenden Wort
 */
export function findNumberInputs(relPath, source) {
  const funde = [];
  const lines = source.split('\n');

  lines.forEach((line, index) => {
    if (!/type=["']number["']/.test(line)) return;

    // Das Element umfasst mehrere Zeilen — die Nachbarschaft mitlesen, weil
    // `id` und `value` typischerweise ober- oder unterhalb von `type` stehen.
    const von = Math.max(0, index - 6);
    const bis = Math.min(lines.length, index + 7);
    const umfeld = lines.slice(von, bis).join('\n');

    // Kommentierte Zeilen zaehlen nicht.
    if (/^\s*(\/\/|\*|\{\s*\/\*)/.test(line)) return;

    const woerter = [...umfeld.matchAll(NAMING_ATTRS)]
      .map((m) => m[1].toLowerCase())
      .join(' ');

    const treffer = DECIMAL_HINTS.find((hint) => woerter.includes(hint));
    if (treffer) {
      funde.push({ file: relPath, line: index + 1, hint: treffer });
    }
  });

  return funde;
}
