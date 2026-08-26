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
import {
  endetMitFragezeichen,
  hatVerb,
  istFrage,
  normalisiereAktion,
  restText,
} from './action-intent';

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

/** Ohne dieses Wort im Satz ist nichts eindeutig ein BUDGET-Befehl. */
const BUDGET_WORT = /budget|бюджет/;

/**
 * Der Textrest als Kategorie-Kandidat: „lege 200 € budget für lebensmittel
 * an" ⇒ „lebensmittel". Gate, Verbtisch und Rest-Extraktion liegen seit
 * Welle 5 in `action-intent.ts` — sechs Kopien eines Imperativ-Gates wären
 * sechs Orte, an denen eine Frage zum Befehl werden kann.
 */
function kategorieText(n: string): string | undefined {
  return restText(n, BUDGET_WORT);
}

export function extrahiereBudgetAktion(text: string): BudgetAktionsAbsicht | null {
  const n = normalisiereAktion(text);

  // Das Imperativ-Gate zuerst — die Sicherung, nicht die Erkennung.
  if (istFrage(n) || endetMitFragezeichen(text)) return null;
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

  if (hatVerb(n, 'loeschen')) {
    return { art: 'loeschen', kategorieText: kategorieText(n) };
  }

  // Anlegen VOR Setzen: „erstell" enthält „stell" als Teilzeichenkette —
  // ein ausdrückliches Anlege-Verb gewinnt gegen das generischere Setzen.
  if (hatVerb(n, 'anlegen') && betrag !== undefined) {
    return { art: 'anlegen', betrag, kategorieText: kategorieText(n) };
  }

  const istErhoehen = hatVerb(n, 'erhoehen');
  const istSenken = hatVerb(n, 'senken');
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
  if (hatVerb(n, 'setzen') && betrag !== undefined) {
    return { art: 'aendern', modus: 'auf', betrag, richtung: 'mehr', kategorieText: kategorieText(n) };
  }

  return null;
}
