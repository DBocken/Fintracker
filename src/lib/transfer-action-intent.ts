/**
 * Übertrags-Befehl aus Freitext (Welle 5).
 *
 * „Markiere die erkannten Umbuchungen als Überträge." Damit wird ausführbar,
 * was `transfer.kandidaten` aus Welle 2 nur anzeigen konnte.
 *
 * **Diese Aktion wiegt schwerer als die anderen beiden**, und das gehört an
 * den Anfang der Datei: Ein markierter Übertrag verschwindet aus JEDER
 * Auswertung — Monatssummen, Kategorie-Anteile, Durchschnitte, Trends ändern
 * sich rückwirkend. Wer sie versehentlich auslöst, sucht die Ursache in den
 * Zahlen und findet sie dort nie. Deshalb ist das Gate hier am strengsten:
 * Das Übertrags-Wort ist Pflicht, und ein blosses Markier-Verb qualifiziert
 * nicht.
 *
 * Gate, Verbtisch und Rest-Extraktion liegen in `action-intent.ts`.
 */
import { endetMitFragezeichen, hatVerb, istFrage, normalisiereAktion } from './action-intent';

export type TransferAktionsAbsicht = { art: 'markieren' };

/** Ohne dieses Wort ist nichts eindeutig ein ÜBERTRAGS-Befehl. */
const TRANSFER_WORT =
  /umbuchung|umbuchungen|uebertrag|uebertraege|eigenuebertrag|transfer|transfers|перевод/;

export function extrahiereTransferAktion(text: string): TransferAktionsAbsicht | null {
  const n = normalisiereAktion(text);

  // Das Imperativ-Gate zuerst — die Sicherung, nicht die Erkennung.
  if (istFrage(n) || endetMitFragezeichen(text)) return null;
  if (!TRANSFER_WORT.test(n)) return null;
  if (!hatVerb(n, 'markieren') && !hatVerb(n, 'zuordnen')) return null;

  return { art: 'markieren' };
}
