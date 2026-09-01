/**
 * Inhaltliche Identität einer Buchung (Audit 2026-09, F3a).
 *
 * ## Wozu
 *
 * Die CSV-ID enthielt den **Zeilenindex**. Zwei überlappende Exporte derselben
 * Bank — Januar–März und Februar–April — ergaben für dieselbe Buchung
 * verschiedene IDs, weil sie in der zweiten Datei an anderer Stelle stand. Der
 * Import legte sie ein zweites Mal an, und ab da zählte jede Summe sie doppelt.
 * Niemand bekam eine Fehlermeldung; die Zahlen wurden nur falsch.
 *
 * Der Ersatz ist ein **Vorkommenszähler**: nicht „die wievielte Zeile der
 * Datei", sondern „das wievielte Mal genau dieser Inhalt in dieser Datei". Zwei
 * inhaltlich gleiche Zeilen bleiben damit unterscheidbar (eine Bank darf am
 * selben Tag zweimal denselben Betrag beim selben Händler buchen), und
 * dieselbe Zeile in zwei Exporten bekommt dieselbe ID.
 *
 * ## Die Grenze, die der Zähler NICHT schließt
 *
 * Er läuft je Datei. Enthält der Bestand mehrere identische Buchungen desselben
 * Tages und schneidet der zweite Export mitten in diese Wiederholungsreihe,
 * steht dieselbe Buchung dort auf Position 0 statt 1 — verschiedene ID,
 * Dublette. Ohne ein Merkmal, das die beiden Zeilen unterscheidet, ist das
 * nicht lösbar. Aufgefangen wird der Fall von der **inhaltlichen Zweit-Dedup**
 * beim Speichern, die deshalb kein Sonderweg für Bestandsnutzer ist, sondern
 * der eigentliche Wächter der Idempotenz.
 *
 * Liegt in `lib/`, nicht im Service: reine Funktionen ohne I/O (AGENTS.md §3),
 * und der Speicherpfad braucht sie genauso wie der Importpfad.
 */

/** Feldtrenner, der in keinem Bankfeld vorkommt (ASCII Unit Separator). */
const TRENNER = '\u001f';

/** Die Felder, die eine Buchung inhaltlich ausmachen. */
export interface TransaktionsInhalt {
  date?: string | null;
  amount?: number | string | null;
  payee?: string | null;
  description?: string | null;
  currency?: string | null;
  counterparty_iban?: string | null;
}

/**
 * Inhaltlicher Schlüssel einer Buchung — gleich für dieselbe Buchung in zwei
 * Exporten, verschieden für zwei verschiedene Buchungen.
 *
 * Bewusst **nicht** mit `buildTxIdentifier` (GoCardless) verschmolzen: Der
 * Bankpfad kennt `account_id` und den Rohtext der Bank, der CSV-Pfad kennt
 * Empfänger, Verwendungszweck und IBAN der Gegenseite. Ein gemeinsamer
 * Schlüssel müsste sich auf die Schnittmenge beschränken und würde damit auf
 * beiden Seiten schlechter unterscheiden.
 */
export function buildCsvContentKey(inhalt: TransaktionsInhalt): string {
  const betrag =
    inhalt.amount === null || inhalt.amount === undefined
      ? ''
      : Number(inhalt.amount).toFixed(2);
  return [
    (inhalt.date ?? '').trim(),
    betrag,
    (inhalt.payee ?? '').trim(),
    (inhalt.description ?? '').trim(),
    (inhalt.currency ?? '').trim(),
    (inhalt.counterparty_iban ?? '').trim(),
  ].join(TRENNER);
}

/**
 * Zählt je Inhalt mit, das wievielte Vorkommen gerade dran ist.
 *
 * Synchron und in Zeilenreihenfolge zu benutzen — der Zähler ist die Stelle in
 * der Wiederholungsreihe, und die ist nur deterministisch, solange niemand
 * nebenher zählt.
 */
export function createOccurrenceCounter(): (inhalt: TransaktionsInhalt) => number {
  const gesehen = new Map<string, number>();
  return (inhalt) => {
    const schluessel = buildCsvContentKey(inhalt);
    const bisher = gesehen.get(schluessel) ?? 0;
    gesehen.set(schluessel, bisher + 1);
    return bisher;
  };
}
