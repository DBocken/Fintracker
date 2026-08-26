/**
 * Gemeinsame Grundlage aller SCHREIBENDEN Chat-Absichten (Welle 5).
 *
 * WP-I hat die erste gebaut — Budgets — und dabei drei Bausteine erfunden,
 * die für jede weitere Aktion gleich aussehen: das **Imperativ-Gate**, die
 * **Normalisierung** und die **Rest-Extraktion** des Bezugsworts. Sie hier
 * zusammenzuziehen ist kein Aufräumen, sondern dieselbe Entscheidung, die in
 * den Wellen 1–3 viermal reine Funktionen aus Diensten geholt hat: Sechs
 * Kopien eines Gates sind sechs Orte, an denen eine FRAGE zum Befehl werden
 * kann — und das ist der teuerste Fehler dieser Fläche.
 *
 * **Das Imperativ-Gate ist die Sicherung, nicht die Erkennung.** Eine falsch
 * beantwortete Frage zeigt eine falsche Zahl; ein falsch gedeuteter Befehl
 * schlägt eine Änderung an den Daten vor. Deshalb steht es VOR jeder
 * Verb-Prüfung und ist absichtlich streng: Im Zweifel keine Aktion.
 *
 * Was hier NICHT steht: die Nutzlast je Aktionsart (Betrag, Kategorie,
 * Anlassname). Die ist fachlich und gehört zur jeweiligen Grammatik — hier
 * liegt nur, was für alle gilt.
 */

/** Dieselbe Faltung wie Matcher und Szenario-Grammatik. */
export function normalisiereAktion(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

/**
 * Fragewörter und Modalformen, nach denen NIE eine Aktion folgt.
 *
 * `welche` steht bewusst OHNE Wortgrenze: „welches", „welchen", „welcher"
 * sind dieselbe Frage — gemessen fiel „Welches Budget sollte ich reduzieren?"
 * genau durch diese Lücke und wurde zum Befehl (WP-I, Regressionstest).
 */
const FRAGE_SIGNALE =
  /(^|\s)(wie|was|wann|warum|wieso|wieviel|wie viel|kann ich|koennte|sollte ich|soll ich|darf ich|lohnt|how|what|which|when|why|should i|can i|could i|is it worth|сколько|какие|какой|когда|почему|могу ли|стоит ли)\b/;

const FRAGE_WELCHE = /(^|\s)welche/;

/**
 * Ist der Text eine FRAGE und damit strukturell nie ein Befehl?
 *
 * Auch dann, wenn ein Aktionsverb im Nebensatz steht: „kann ich mein Budget
 * erhöhen, ohne …" fragt, befiehlt nicht.
 */
export function istFrage(normalisiert: string): boolean {
  return FRAGE_SIGNALE.test(normalisiert) || FRAGE_WELCHE.test(normalisiert);
}

/**
 * Ein Fragezeichen macht aus jedem Satz eine Frage — auch aus einem, der
 * grammatisch wie ein Befehl aussieht („Budget für Essen anlegen?").
 *
 * Bewusst am ROHTEXT geprüft, nicht am normalisierten: Die Normalisierung
 * lässt Satzzeichen zwar stehen, aber die Absicht ist hier eine andere als
 * bei den Wortsignalen — deshalb eine eigene Funktion statt einer Zeile mehr
 * in `istFrage`.
 */
export function endetMitFragezeichen(rohtext: string): boolean {
  return /\?\s*$/.test(rohtext);
}

/**
 * Verben, die eine SCHREIB-Aufforderung tragen — nach Wirkung gruppiert.
 *
 * Wortanfänge, normalisiert, dreisprachig. Bewusst OHNE generische Wörter
 * („mach", „ändere" allein): Jeder Eintrag hier ist eine Aufforderung, kein
 * Gesprächswort.
 *
 * **Reihenfolge der Prüfung ist Sache des Aufrufers** — und sie ist nicht
 * beliebig: „erstell" enthält „stell" als Teilzeichenkette, ein
 * ausdrückliches Anlege-Verb muss deshalb VOR dem generischeren Setzen
 * geprüft werden (WP-I, gemessen).
 */
export const AKTIONS_VERBEN = {
  anlegen: [
    'lege', 'leg ', 'erstell', 'anlegen', 'einrichten', 'richte', 'neuer', 'neues',
    'create', 'set up', 'add ', 'установи', 'создай', 'добавь',
  ],
  erhoehen: ['erhoeh', 'erhöh', 'stock', 'increase', 'raise', 'увеличь', 'подними'],
  senken: ['senk', 'reduzier', 'verringer', 'kuerze', 'decrease', 'reduce', 'lower', 'уменьши', 'снизь'],
  setzen: ['setz', 'stell', 'set ', 'поставь'],
  loeschen: ['loesch', 'entfern', 'delete', 'remove', 'удали'],
  zuordnen: [
    'ordne', 'zuordnen', 'weise', 'buche', 'stecke', 'pack', 'kategorisier',
    'assign', 'categorise', 'categorize', 'file ', 'отнеси', 'присвой', 'категоризируй',
  ],
  markieren: ['markier', 'verknuepf', 'verknüpf', 'verbinde', 'mark ', 'link ', 'отметь', 'свяжи'],
  merken: ['merk', 'immer', 'kuenftig', 'künftig', 'always', 'from now on', 'запомни', 'всегда'],
} as const;

export type AktionsVerbGruppe = keyof typeof AKTIONS_VERBEN;

/** Trifft eines der Verben dieser Gruppe? */
export function hatVerb(normalisiert: string, gruppe: AktionsVerbGruppe): boolean {
  return AKTIONS_VERBEN[gruppe].some((v) => normalisiert.includes(normalisiereAktion(v)));
}

/**
 * Füllwörter, die bei der Rest-Extraktion wegfallen. Dreisprachig, bewusst
 * knapp: Sie muss nur die Wörter kennen, die in Befehlssätzen vorkommen.
 */
const FUELLWOERTER = new Set([
  'ein', 'eine', 'einen', 'einem', 'mein', 'meine', 'meinem', 'meinen', 'mir', 'mich',
  'das', 'der', 'die', 'den', 'dem', 'fuer', 'auf', 'um', 'von', 'an', 'als', 'bei',
  'bitte', 'euro', 'eur', 'im', 'in', 'monat', 'monatlich', 'neues', 'neuer', 'neue',
  'alle', 'allen', 'zum', 'zur', 'nach', 'und', 'ist', 'sind', 'war', 'werden',
  'a', 'an', 'the', 'my', 'for', 'to', 'by', 'of', 'per', 'month', 'monthly',
  'new', 'please', 'all', 'as', 'at', 'in', 'is', 'are',
  'мой', 'моя', 'на', 'в', 'для', 'все', 'как',
]);

/**
 * Der Textrest als Bezugswort-Kandidat: Wörter des Satzes ohne Verben,
 * Füllwörter, Zahlen — und ohne die vom Aufrufer genannten Fachwörter
 * („budget", „regel", „anlass").
 *
 * Bewusst GROB. Die echte Auflösung samt Mehrdeutigkeit und Rückfrage macht
 * das bestehende Vokabular im ViewModel; zwei Auflösungswege würden driften
 * (WP-I).
 */
export function restText(normalisiert: string, fachwoerter: RegExp): string | undefined {
  const alleVerben = Object.values(AKTIONS_VERBEN).flat();
  const worte = normalisiert
    .split(/[^\p{L}]+/u)
    .filter(
      (w) =>
        w.length >= 3 &&
        !FUELLWOERTER.has(w) &&
        !fachwoerter.test(w) &&
        !alleVerben.some((v) => w.startsWith(normalisiereAktion(v).trim())),
    );
  return worte.length > 0 ? worte.join(' ') : undefined;
}
