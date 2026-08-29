/**
 * Kategorisier-Befehle aus Freitext (Welle 5).
 *
 * Zwei Absichten, die zusammengehören und doch verschieden sind — und der
 * Unterschied ist der Kern dieser Datei:
 *
 * - **`zuordnen`** wirkt auf den BESTAND: „Ordne die Rewe-Buchungen
 *   Lebensmitteln zu." Eine einmalige Korrektur; künftige Buchungen bleiben
 *   davon unberührt.
 * - **`merken`** wirkt auf die ZUKUNFT: „Merk dir, Rewe ist immer
 *   Lebensmittel." Das legt eine Händlerregel an, die ab dann jede neue
 *   Buchung fängt — und die Regel schlägt in der Kaskade sogar den gelernten
 *   Klassifikator.
 *
 * Beides zu verwechseln wäre kein Schönheitsfehler: Wer „ordne zu" sagt und
 * eine Dauerregel bekommt, hat eine Automatik eingeschaltet, um die er nicht
 * gebeten hat. Wer „merk dir" sagt und nur eine Korrektur bekommt, wundert
 * sich beim nächsten Import. Deshalb entscheidet ein ausdrückliches
 * Dauer-Signal, nicht die Tonlage.
 *
 * Wie bei den Budgets (WP-I): Diese Datei extrahiert nur. Gate, Verbtisch und
 * Rest-Extraktion liegen in `action-intent.ts`; die Vorschau rechnet das
 * Register rein, und geschrieben wird ausschliesslich im Bestätigen-Klick.
 */
import {
  endetMitFragezeichen,
  hatVerb,
  istFrage,
  normalisiereAktion,
  restText,
} from '@/features/shared/domain/action-intent';

export type KategorieAktionsAbsicht = {
  /** `zuordnen` korrigiert den Bestand, `merken` legt eine Dauerregel an. */
  art: 'zuordnen' | 'merken';
  /** Roher Händlertext — aufgelöst wird er im ViewModel über das Vokabular. */
  haendlerText?: string;
  /** Roher Kategorietext — dieselbe Auflösung wie beim Lesen. */
  kategorieText?: string;
};

/**
 * Wörter, die eine DAUERregel meinen statt einer einmaligen Korrektur.
 *
 * Bewusst eng: „immer", „künftig", „ab jetzt", „merk dir". Ein blosses
 * „ordne zu" ist keine Dauerregel — und im Zweifel ist die einmalige
 * Korrektur die kleinere Änderung.
 */
const DAUER_SIGNAL =
  /\b(immer|kuenftig|zukuenftig|ab jetzt|ab sofort|jedes mal|generell|always|from now on|in future|every time|всегда|впредь)\b/;

/** Fachwörter, die nicht Teil des Händler- oder Kategorienamens sind. */
const FACHWOERTER = /^(buchung|buchungen|transaktion|transaktionen|kategorie|kategorien|regel|regeln|transaction|transactions|category|categories|rule|rules|операц|категор|правил)/;

/**
 * Trennt Händler und Kategorie am Zuordnungswort.
 *
 * „ordne REWE der Kategorie LEBENSMITTEL zu" — vor dem Trenner steht, WAS
 * zugeordnet wird, danach WOHIN. Ohne Trenner bleibt nur ein Rest, und der
 * ist mehrdeutig; dann wird er als Händler geführt und die Kategorie
 * nachgefragt. Raten wäre hier besonders teuer: Eine falsch zugeordnete
 * Kategorie verfälscht jede spätere Summe.
 */
const TRENNER = /\s(?:zu|als|in|nach|to|as|into|в|как)\s/;

export function extrahiereKategorieAktion(text: string): KategorieAktionsAbsicht | null {
  const n = normalisiereAktion(text);

  // Das Imperativ-Gate zuerst — die Sicherung, nicht die Erkennung.
  if (istFrage(n) || endetMitFragezeichen(text)) return null;

  const istDauer = DAUER_SIGNAL.test(n) || hatVerb(n, 'merken');
  const istZuordnen = hatVerb(n, 'zuordnen');
  if (!istDauer && !istZuordnen) return null;

  // Ohne Kategorie-Bezug ist „merk dir das" kein Kategorisier-Befehl. Das
  // Dauer-Signal allein qualifiziert nicht — sonst würde jedes „immer" im
  // Satz eine Schreib-Vorschau auslösen.
  if (istDauer && !istZuordnen && !/(kategori|category|категор|ist|sind|is |=)/.test(n)) return null;

  const teile = n.split(TRENNER);
  const links = restText(teile[0] ?? '', FACHWOERTER);
  const rechts = teile.length > 1 ? restText(teile.slice(1).join(' '), FACHWOERTER) : undefined;

  return {
    art: istDauer ? 'merken' : 'zuordnen',
    haendlerText: links,
    kategorieText: rechts,
  };
}
