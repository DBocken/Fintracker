/**
 * Anlass-Befehle aus Freitext (Welle 5).
 *
 * Zwei Absichten:
 *
 * - **`anlegen`** — „Leg einen Anlass Urlaub Italien an."
 * - **`zuordnen`** — „Ordne die Buchungen dem Anlass Urlaub zu." Damit wird
 *   die Vorschlagsliste aus Welle 2 ausführbar: `suggestTransactionsForEvent`
 *   existiert seit Langem und konnte bisher nur ANZEIGEN.
 *
 * **Das Anlass-Wort ist Pflicht** — und das ist nicht Formalie, sondern die
 * Abgrenzung zum Kategorisier-Befehl: „Ordne Rewe zu Lebensmitteln" und
 * „Ordne die Buchungen dem Anlass Urlaub zu" tragen dasselbe Verb und
 * dieselbe Satzform. Ohne ein ausdrückliches Signal liesse sich nur raten,
 * welche der beiden Achsen gemeint ist — und die falsche zu treffen hiesse,
 * eine Kategorie zu ändern, wo eine Anlass-Zuordnung gemeint war.
 *
 * Gate, Verbtisch und Rest-Extraktion liegen in `action-intent.ts`.
 */
import {
  endetMitFragezeichen,
  hatVerb,
  istFrage,
  normalisiereAktion,
  restText,
} from './action-intent';

export type AnlassAktionsAbsicht = {
  art: 'anlegen' | 'zuordnen';
  /** Roher Anlasstext — aufgelöst wird er im ViewModel über das Vokabular. */
  anlassText?: string;
};

/** Ohne dieses Wort ist nichts eindeutig ein ANLASS-Befehl. */
const ANLASS_WORT = /anlass|anlaesse|ereignis|event|projekt|событи|повод/;

/** Fachwörter, die nicht Teil des Anlassnamens sind. */
const FACHWOERTER =
  /^(anlass|anlaesse|ereignis|ereignisse|event|events|projekt|buchung|buchungen|vorschlag|vorschlaege|transaction|transactions|suggestion|suggestions|событи|повод|операц)/;

export function extrahiereAnlassAktion(text: string): AnlassAktionsAbsicht | null {
  const n = normalisiereAktion(text);

  // Das Imperativ-Gate zuerst — die Sicherung, nicht die Erkennung.
  if (istFrage(n) || endetMitFragezeichen(text)) return null;
  if (!ANLASS_WORT.test(n)) return null;

  if (hatVerb(n, 'anlegen')) {
    return { art: 'anlegen', anlassText: restText(n, FACHWOERTER) };
  }
  if (hatVerb(n, 'zuordnen')) {
    return { art: 'zuordnen', anlassText: restText(n, FACHWOERTER) };
  }
  return null;
}
