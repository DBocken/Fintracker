/**
 * Budget-Aktionen aus Freitext (WP-I) — die erste SCHREIBENDE Absicht des
 * Chats, und deshalb mit der härtesten Regel des Pakets: **Der Chat schreibt
 * nie aus eigener Deutung.** Diese Datei extrahiert nur; die Vorschau rechnet
 * das Register rein, und die einzige schreibende Stelle ist der
 * Bestätigen-Klick in der Fläche.
 *
 * Ebene 1 (AGENTS.md §3): deterministische Grammatik. Das **Imperativ-Gate**
 * ist ihr Kern — nur ein Aktionsverb qualifiziert. „Wie viel Budget hab ich
 * noch?" enthält das Wort Budget und einen Betrag wäre schnell gefunden;
 * eine Frage darf strukturell NIE als Aktion gedeutet werden, denn eine
 * falsch beantwortete Frage zeigt eine falsche Zahl, eine falsch gedeutete
 * Aktion schlägt eine Schreiboperation vor.
 *
 * `kategorieText` bleibt ROHER Text: Aufgelöst wird er im ViewModel über
 * dasselbe Vokabular wie beim Lesen (`resolveKategorieAusText`) — zwei
 * Auflösungswege würden driften.
 */
import { parseBetraege } from './scenario-intent';

export type BudgetAktionsAbsicht =
  | { art: 'anlegen'; betrag: number; kategorieText?: string }
  | {
      /**
       * `modus 'auf'` setzt absolut („setz essen auf 250"), `'um'` verschiebt
       * relativ („erhöhe freizeit um 50") — `richtung` entscheidet dann das
       * Vorzeichen. Verwechselt wären beide eine still falsche Zahl.
       */
      art: 'aendern';
      modus: 'auf' | 'um';
      betrag: number;
      richtung: 'mehr' | 'weniger';
      kategorieText?: string;
    }
  | { art: 'loeschen'; kategorieText?: string };

/** Dieselbe Faltung wie Matcher und Szenario-Grammatik. */
function normalisiere(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

/**
 * Aktionsverben je Art — Wortanfänge, normalisiert. Bewusst OHNE generische
 * Wörter („mach", „aendere" allein): Jedes Verb hier ist eine
 * Schreib-Aufforderung, kein Gesprächswort.
 */
const VERBEN = {
  anlegen: [
    'lege', 'leg ', 'erstell', 'anlegen', 'einrichten', 'richte',
    'create', 'set up', 'add a budget', 'установи бюджет', 'создай',
  ],
  erhoehen: ['erhoeh', 'erhöh', 'stock', 'increase', 'raise', 'увеличь', 'подними'],
  senken: ['senk', 'reduzier', 'verringer', 'kuerze', 'decrease', 'reduce', 'lower', 'уменьши', 'снизь'],
  setzen: ['setz', 'stell', 'set ', 'поставь'],
  loeschen: ['loesch', 'entfern', 'delete', 'remove', 'удали'],
} as const;

/** Ohne dieses Wort im Satz ist nichts eindeutig ein BUDGET-Befehl. */
const BUDGET_WORT = /budget|бюджет/;

function enthaelt(text: string, signale: readonly string[]): boolean {
  return signale.some((s) => text.includes(normalisiere(s)));
}

/**
 * Der Textrest als Kategorie-Kandidat: Wörter des Satzes ohne Verben,
 * Füllwörter, Budget-Wort und Zahlen. „lege 200 € budget für lebensmittel
 * an" ⇒ „lebensmittel". Bewusst grob — die ECHTE Auflösung (inkl.
 * Mehrdeutigkeit und Rückfrage) macht das bestehende Vokabular im ViewModel.
 */
const FUELLWOERTER = new Set([
  'ein', 'eine', 'einen', 'mein', 'meine', 'mir', 'das', 'der', 'die', 'den',
  'fuer', 'auf', 'um', 'von', 'an', 'bitte', 'euro', 'eur', 'im', 'monat',
  'monatlich', 'neues', 'budget', 'budgets', 'a', 'an', 'the', 'my', 'for',
  'to', 'by', 'of', 'per', 'month', 'monthly', 'new', 'please',
]);

function kategorieText(n: string): string | undefined {
  const worte = n
    .split(/[^\p{L}]+/u)
    .filter(
      (w) =>
        w.length >= 3 &&
        !FUELLWOERTER.has(w) &&
        !BUDGET_WORT.test(w) &&
        !Object.values(VERBEN).some((liste) => liste.some((v) => w.startsWith(normalisiere(v).trim()))),
    );
  return worte.length > 0 ? worte.join(' ') : undefined;
}

export function extrahiereBudgetAktion(text: string): BudgetAktionsAbsicht | null {
  const n = normalisiere(text);

  // Fragen sind nie Aktionen — auch wenn ein Aktionsverb im Nebensatz steht
  // („kann ich mein budget erhoehen ohne …" fragt, befiehlt nicht).
  // `welche` steht bewusst OHNE Wortgrenze am Ende: „welches", „welchen",
  // „welcher" sind dieselbe Frage — gemessen fiel „Welches Budget sollte ich
  // reduzieren …?" genau durch diese Lücke und wurde zum Befehl.
  if (/(^|\s)(wie|was|wann|warum|wieviel|wie viel|kann ich|koennte|sollte ich|soll ich|how|what|which|should i|can i|сколько|какие|могу ли)\b/.test(n)) {
    return null;
  }
  if (/(^|\s)welche/.test(n)) return null;
  if (!BUDGET_WORT.test(n)) return null;

  const betraege = parseBetraege(n);
  let betrag = betraege[0]?.wert;
  let betragIndex = betraege[0]?.index ?? -1;
  if (betrag === undefined) {
    // `parseBetraege` lässt nackte Zahlen unter 100 bewusst fallen („2
    // Monate" ist eine Anzahl). Nach einer Betrags-Präposition ist die
    // kleine Zahl hier aber eindeutig Geld: „erhöhe … um 50", „by 50".
    const klein = n.match(/(?:um|auf|by|to|von|of|на|до)\s+(\d{1,6}(?:,\d{1,2})?)(?!\s*(?:monat|month|tag|day|woche|week|jahr|year|prozent|percent|%))/u);
    if (klein) {
      const wert = Number(klein[1].replace(',', '.'));
      if (Number.isFinite(wert) && wert > 0) {
        betrag = wert;
        betragIndex = (klein.index ?? 0) + klein[0].length - klein[1].length;
      }
    }
  }

  if (enthaelt(n, VERBEN.loeschen)) {
    return { art: 'loeschen', kategorieText: kategorieText(n) };
  }

  // Anlegen VOR Setzen: „erstell" enthält „stell" als Teilzeichenkette —
  // ein ausdrückliches Anlege-Verb gewinnt gegen das generischere Setzen.
  if (enthaelt(n, VERBEN.anlegen) && betrag !== undefined) {
    return { art: 'anlegen', betrag, kategorieText: kategorieText(n) };
  }

  const istErhoehen = enthaelt(n, VERBEN.erhoehen);
  const istSenken = enthaelt(n, VERBEN.senken);
  if ((istErhoehen || istSenken) && betrag !== undefined) {
    // „auf" gewinnt nur, wenn es unmittelbar VOR dem Betrag steht („erhöhe
    // essen auf 250" = absolut); sonst ist die Änderung relativ („um 50").
    const vorBetrag = n.slice(0, betragIndex);
    const modus: 'auf' | 'um' = /(auf|to|до)\s*$/.test(vorBetrag) ? 'auf' : 'um';
    return {
      art: 'aendern',
      modus,
      betrag,
      richtung: istSenken ? 'weniger' : 'mehr',
      kategorieText: kategorieText(n),
    };
  }
  if (enthaelt(n, VERBEN.setzen) && betrag !== undefined) {
    return { art: 'aendern', modus: 'auf', betrag, richtung: 'mehr', kategorieText: kategorieText(n) };
  }

  return null;
}
