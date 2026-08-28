/**
 * Freitext → strukturierte Szenario-Absicht (WP-H).
 *
 * Der Befund dahinter: Die Rechen-Engine kann kombinierte Was-wäre-wenn-
 * Fragen längst beantworten — `applyScenario` entfernt Verträge ab einem
 * Datum (`flow`, factor 0), erhöht Einkommen ab einem Datum (factor > 1,
 * `fromDate`), terminiert Einmalausgaben (`oneTime`) und
 * `runScenarioPayload` prüft jede Schwelle gegen alle Monte-Carlo-Pfade.
 * Was fehlte, war ausschliesslich der Übersetzer: aus „mein Auto verkaufe
 * ich, in 2 Monaten kommt die Gehaltserhöhung, kann ich im Dezember für 5k
 * in den Urlaub ohne den Notgroschen anzugreifen?" die MENGE der Deltas.
 *
 * **Ebene 1, keine Inferenz** (AGENTS.md §3): Diese Datei ist eine
 * deterministische Absichts-Grammatik — Signalwörter, Beträge, Zukunfts-
 * Zeitausdrücke, je Teilsatz zusammengesetzt. Was sie nicht sicher zuordnen
 * kann, lässt sie WEG statt zu raten; die Fläche zeigt die erkannten Deltas
 * als korrigierbare Chips, bevor eine Zahl entsteht. Eine falsche Annahme
 * in einer Simulation ist schlimmer als eine Rückfrage.
 *
 * **Abgrenzung zu `question-time-expressions.ts`:** `parseZeitraum` löst in
 * die VERGANGENHEIT auf („im Dezember" = letzter vergangener Dezember),
 * weil Auswertungen nur über Vorhandenes berichten können. Ein Szenario
 * plant — {@link parseZukunft} löst denselben Monatsnamen deshalb in die
 * Zukunft auf und liefert einen TAG-OFFSET, das Format, das
 * `ScenarioPayload.dayIndex` und `AffordabilityGoal.dayIndex` erwarten.
 * Beide Funktionen existieren bewusst nebeneinander; keine ersetzt die
 * andere.
 *
 * Erkennungsdaten, kein Bildschirmtext — deshalb nicht im Sprachbaum
 * (dieselbe Einordnung wie `question-time-expressions.ts` und
 * `category-concepts.ts`).
 */
import { findeKonzeptImText } from '@/lib/category-concepts';
import { normalisiereFrage } from '@/lib/text-normalisierung';

/** Eine erkannte Veränderung gegenüber dem Ist-Zustand. */
export type SzenarioDelta =
  | {
      /** Terminierte Einmalausgabe („5k Urlaub im Dezember"). */
      art: 'einmalausgabe';
      betrag: number;
      abTag: number;
      /** Erkannter Oberbegriff („urlaub") — Nutzerkontext, kein i18n-Text. */
      label?: string;
    }
  | {
      /**
       * Einkommensänderung ab einem Tag. `betragProMonat` signiert
       * (+ Erhöhung, − Minderung); `prozent` signiert (−100 = Jobverlust).
       * BEIDE offen = erkannt, aber unbeziffert — die Fläche fragt nach dem
       * Betrag, statt einen zu erfinden.
       */
      art: 'einkommen';
      betragProMonat?: number;
      prozent?: number;
      abTag: number;
    }
  | {
      /**
       * Wiederkehrende Posten entfallen („Auto verkaufen" ⇒ Werkstatt,
       * Versicherung, Kraftstoff). `stichworte` sind die Suchbegriffe des
       * erkannten Oberbegriffs — sie treffen Verträge über Name/Kategorie
       * (`FlowSelector` mit `keyword`), nie über eine ID-Liste.
       */
      art: 'flow_entfaellt';
      konzept: string;
      stichworte: readonly string[];
      abTag: number;
    }
  | {
      /** Neuer wiederkehrender Posten („spare zusätzlich 200 im Monat"). */
      art: 'flow_neu';
      betragProMonat: number;
      richtung: 'einnahme' | 'ausgabe';
      abTag: number;
    };

export interface SzenarioAbsicht {
  deltas: SzenarioDelta[];
  /**
   * „… ohne den Notgroschen anzugreifen": Die Schwelle ist eine ABSICHT,
   * kein Betrag — der EUR-Wert kommt aus der Forecast-Konfiguration
   * (`safetyBuffer`), nie aus dem Fragetext.
   */
  schwelle?: 'notgroschen';
}

/** Ein gefundener Betrag mit seiner Position im normalisierten Text. */
export interface BetragTreffer {
  wert: number;
  index: number;
  laenge: number;
}

/** Ein gefundener Zukunfts-Zeitausdruck mit Position. */
export interface ZukunftTreffer {
  /** Tage ab heute (>= 1). */
  abTag: number;
  index: number;
  laenge: number;
}

/** Dieselbe Faltung wie im Matcher — beide sehen denselben Text. */
function normalisiere(text: string): string {
  return normalisiereFrage(text);
}

/**
 * Alle Geldbeträge eines Textes, in Textreihenfolge.
 *
 * Gegenüber dem Ein-Betrag-Parser des Matchers zwei Erweiterungen, die die
 * Referenzfrage erzwungen hat: **`k`-Suffix** („2k", „1,5k" — Faktor 1000)
 * und **mehrere Treffer** (Einkommen UND Ausgabe in einer Frage). Nackte
 * kleine Zahlen ohne Währungszeichen bleiben ausgeschlossen, wenn sie Teil
 * eines Zeitausdrucks sind — der Aufrufer schneidet Zeitausdrücke vorher
 * heraus, wie es der Matcher mit `ohneZeit` auch tut.
 */
export function parseBetraege(text: string): BetragTreffer[] {
  const n = normalisiere(text);
  const treffer: BetragTreffer[] = [];
  const regex = /\b(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(k\b)?\s*(€|eur\b|euro\b)?/g;
  for (const m of n.matchAll(regex)) {
    const hatK = m[3] !== undefined;
    const hatWaehrung = m[4] !== undefined;
    const ganz = m[1].replace(/\./g, '');
    const nachkomma = m[2] ? `.${m[2]}` : '';
    let wert = Number(`${ganz}${nachkomma}`);
    if (!Number.isFinite(wert) || wert <= 0) continue;
    if (hatK) wert *= 1000;
    // Eine nackte Zahl unter 100 ohne k/€ ist häufiger eine Anzahl („2
    // Monate", „3 Kinder") als ein Betrag — sie zählt nur mit Ausweis.
    if (!hatK && !hatWaehrung && wert < 100) continue;
    treffer.push({ wert, index: m.index, laenge: m[0].trimEnd().length });
  }
  return treffer;
}

/** Monatsnamen-Erkennung je Sprache (Stämme; ru-Formen decken die Fälle ab). */
const ZUKUNFT_MONATE: Record<string, readonly (readonly [string, number])[]> = {
  de: [
    ['januar', 0], ['februar', 1], ['maerz', 2], ['april', 3], ['mai', 4],
    ['juni', 5], ['juli', 6], ['august', 7], ['september', 8], ['oktober', 9],
    ['november', 10], ['dezember', 11],
  ],
  en: [
    ['january', 0], ['february', 1], ['march', 2], ['april', 3], ['may', 4],
    ['june', 5], ['july', 6], ['august', 7], ['september', 8], ['october', 9],
    ['november', 10], ['december', 11],
  ],
  ru: [
    ['январ', 0], ['феврал', 1], ['март', 2], ['апрел', 3], ['мае', 4],
    ['мая', 4], ['май', 4], ['июн', 5], ['июл', 6], ['август', 7],
    ['сентябр', 8], ['октябр', 9], ['ноябр', 10], ['декабр', 11],
  ],
};

const MS_JE_TAG = 24 * 60 * 60 * 1000;

function tageBis(jetzt: Date, ziel: Date): number {
  return Math.max(1, Math.round((ziel.getTime() - jetzt.getTime()) / MS_JE_TAG));
}

/**
 * Alle ZUKUNFTS-Zeitausdrücke eines Textes als Tag-Offsets, in
 * Textreihenfolge.
 *
 * „In 2 Monaten" ⇒ 60, „im Dezember" ⇒ Tage bis zum 1. des NÄCHSTEN
 * Dezembers (Gegenrichtung zu `parseZeitraum`, siehe Dateikopf), „nächsten
 * Monat" ⇒ 30. Monatsmitte statt Monatserster wäre für eine Ausgabe
 * plausibler, aber der 1. ist die KONSERVATIVE Annahme: Wer am Monatsersten
 * zahlen könnte, kann es auch später.
 */
export function parseZukunft(text: string, locale: string, jetzt: Date): ZukunftTreffer[] {
  const n = normalisiere(text);
  const treffer: ZukunftTreffer[] = [];

  // „in 2 monaten", „in 3 wochen", „in 10 tagen" / en / ru („через …").
  // \p{L}-Lookarounds statt \b: \b kennt nur ASCII und scheitert an „месяца".
  const relativ =
    /(?<!\p{L})(?:in|через)\s+(\d{1,3})\s*(monat(?:en)?|months?|месяц(?:а|ев)?|woche(?:n)?|weeks?|недел[юиь]?|tag(?:en)?|days?|дн(?:я|ей|ь))(?!\p{L})/gu;
  for (const m of n.matchAll(relativ)) {
    const anzahl = Number(m[1]);
    if (!Number.isFinite(anzahl) || anzahl <= 0) continue;
    const einheit = m[2];
    const faktor = /^(monat|month|месяц)/.test(einheit) ? 30 : /^(woche|week|недел)/.test(einheit) ? 7 : 1;
    treffer.push({ abTag: anzahl * faktor, index: m.index, laenge: m[0].length });
  }

  // „nächsten monat" / „next month" / „в следующем месяце".
  const naechster = /(?<!\p{L})(naechsten?\s+monat|next\s+month|следующем\s+месяце)(?!\p{L})/gu;
  for (const m of n.matchAll(naechster)) {
    treffer.push({ abTag: 30, index: m.index, laenge: m[0].length });
  }

  // Jahreszeiten ⇒ 1. ihres nächsten Anfangsmonats („im nächsten Sommer" =
  // 1. Juni). Grob, aber ehrlich grob: Ein Szenario über Monate hinweg hängt
  // nicht am Tag — und die Chips zeigen den angenommenen Termin.
  const saisonMonat: readonly (readonly [RegExp, number])[] = [
    [/(?<!\p{L})(fruehling|fruehjahr|spring|весн)/gu, 2],
    [/(?<!\p{L})(sommer|summer|лет)/gu, 5],
    [/(?<!\p{L})(herbst|autumn|fall|осен)/gu, 8],
    [/(?<!\p{L})(winter|зим)/gu, 11],
  ];
  for (const [regex, monatIndex] of saisonMonat) {
    for (const m of n.matchAll(regex)) {
      const jahr =
        monatIndex > jetzt.getUTCMonth() ? jetzt.getUTCFullYear() : jetzt.getUTCFullYear() + 1;
      const ziel = new Date(Date.UTC(jahr, monatIndex, 1));
      treffer.push({ abTag: tageBis(jetzt, ziel), index: m.index, laenge: m[0].length });
    }
  }

  // Monatsname ⇒ 1. des nächsten Vorkommens.
  for (const [stamm, monatIndex] of ZUKUNFT_MONATE[locale] ?? ZUKUNFT_MONATE.de) {
    const regex = new RegExp(`(?<=^|[^\\p{L}])${stamm}`, 'gu');
    for (const m of n.matchAll(regex)) {
      // Bereits von einem relativen Ausdruck abgedeckte Stelle nicht doppelt.
      if (treffer.some((t) => m.index >= t.index && m.index < t.index + t.laenge)) continue;
      const jahr =
        monatIndex > jetzt.getUTCMonth() ? jetzt.getUTCFullYear() : jetzt.getUTCFullYear() + 1;
      const ziel = new Date(Date.UTC(jahr, monatIndex, 1));
      treffer.push({ abTag: tageBis(jetzt, ziel), index: m.index, laenge: stamm.length });
    }
  }

  return treffer.sort((a, b) => a.index - b.index);
}

/** Signalwörter je Rolle — normalisiert (Umlaute gefaltet), Wortanfänge. */
const SIGNALE = {
  // Komposita, keine blanken Wörter: ein nacktes „erhoehung" träfe auch die
  // Mieterhöhung — das ist eine AUSGABEN-Änderung, keine Einkommens-.
  einkommenAenderung: [
    'gehaltserhoehung', 'lohnerhoehung', 'gehaltssprung', 'mehr gehalt',
    'mehr verdien', 'verdiene mehr', 'raise', 'salary increase', 'pay rise',
    'повышение зарплаты', 'прибавк',
  ],
  einkommenVerlust: [
    'verliere meinen job', 'job verliere', 'jobverlust', 'arbeitslos', 'kuendige meinen job',
    'lose my job', 'quit my job', 'потеряю работу', 'уволь',
  ],
  statusQuo: ['aktuell', 'derzeit', 'momentan', 'zurzeit', 'currently', 'сейчас'],
  entfallen: [
    'verkauf', 'abschaff', 'kuendig', 'entfall', 'fallen weg', 'faellt weg', 'weg fallen',
    'brauche ich nicht mehr', 'los werden', 'loswerden', 'sell', 'cancel', 'get rid',
    'продам', 'продаю', 'откажусь', 'отмен',
  ],
  einmalausgabe: [
    'kauf', 'anschaff', 'urlaub', 'reise', 'fliegen', 'ausgeben', 'leisten', 'goenn',
    'buy', 'purchase', 'holiday', 'vacation', 'trip', 'afford', 'spend',
    'куплю', 'покупк', 'отпуск', 'поездк', 'позволить',
  ],
  monatlich: ['im monat', 'pro monat', 'monatlich', 'jeden monat', 'per month', 'monthly', 'a month', 'в месяц'],
  sparen: ['spare', 'sparen', 'zuruecklegen', 'save', 'откладыва', 'коплю'],
  einnahme: ['bekomme', 'erhalte', 'nebenjob', 'verdiene', 'dazuverdien', 'earn', 'получаю'],
  notgroschen: [
    'notgroschen', 'notreserve', 'eiserne reserve', 'sicherheitspuffer', 'puffer',
    'emergency fund', 'safety buffer', 'финансовую подушку', 'подушк', 'резерв',
  ],
} as const;

function enthaelt(teilsatz: string, signale: readonly string[]): boolean {
  return signale.some((s) => teilsatz.includes(s));
}

/** Textstellen der Zeitausdrücke ausblenden, damit „2" aus „in 2 Monaten" kein Betrag wird. */
function ohneZukunft(teilsatz: string, zukunft: ZukunftTreffer[]): string {
  let ergebnis = teilsatz;
  for (const z of zukunft) {
    ergebnis =
      ergebnis.slice(0, z.index) + ' '.repeat(z.laenge) + ergebnis.slice(z.index + z.laenge);
  }
  return ergebnis;
}

/**
 * Zerlegt eine Frage in Teilsätze und setzt je Teilsatz höchstens EIN Delta
 * zusammen. Teilsatzgrenzen sind Satzzeichen und nebenordnende Konjunktionen —
 * die Rollenzuordnung (welcher Betrag gehört zu welchem Verb) läuft über die
 * Nähe INNERHALB eines Teilsatzes, nicht über Distanzmetriken.
 *
 * `null`, wenn weder ein Delta noch eine Schwelle erkannt wurde — dann ist
 * die Frage kein Kombinations-Szenario und die übrigen Routen (Leistbarkeit,
 * Bestandsauswertung) sind die besseren Antworten.
 */
export function extrahiereSzenarioAbsicht(
  text: string,
  locale: string,
  jetzt: Date,
): SzenarioAbsicht | null {
  const n = normalisiere(text);
  const deltas: SzenarioDelta[] = [];
  const schwelle = enthaelt(n, SIGNALE.notgroschen) ? ('notgroschen' as const) : undefined;

  // Komma nur mit folgendem Leerzeichen — sonst zerschnitte „1.200,50" den
  // Betrag. Dezimalkommas haben nie ein Leerzeichen nach sich.
  const teilsaetze = n
    .split(/[.!?;]|,\s|\bund\b|\band\b|\bи\b/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const teilsatz of teilsaetze) {
    const zukunft = parseZukunft(teilsatz, locale, jetzt);
    const abTag = zukunft[0]?.abTag ?? 0;
    const betraege = parseBetraege(ohneZukunft(teilsatz, zukunft));
    const betrag = betraege[0]?.wert;

    // Reihenfolge = Spezifität: Verlust vor Erhöhung (beide nennen „Job"
    // nicht zwingend), Entfallen vor Einmalausgabe („Auto verkaufen und
    // eins kaufen" bleibt zwei Teilsätze).
    if (enthaelt(teilsatz, SIGNALE.einkommenVerlust)) {
      deltas.push({ art: 'einkommen', prozent: -100, abTag });
      continue;
    }
    if (enthaelt(teilsatz, SIGNALE.einkommenAenderung)) {
      // Ein Ist-Stand („ich verdiene aktuell 2k") ist KEIN Delta — die
      // Baseline kommt aus den Daten, nicht aus dem Text. Der Betrag im
      // Teilsatz gehört nur dann zur Erhöhung, wenn kein Status-quo-Marker
      // daneben steht.
      const istStatusQuo = enthaelt(teilsatz, SIGNALE.statusQuo);
      deltas.push({
        art: 'einkommen',
        betragProMonat: istStatusQuo ? undefined : betrag,
        abTag,
      });
      continue;
    }
    if (enthaelt(teilsatz, SIGNALE.entfallen)) {
      const konzept = findeKonzeptImText(teilsatz, locale);
      if (konzept) {
        deltas.push({
          art: 'flow_entfaellt',
          konzept: konzept.konzept,
          stichworte: konzept.begriffe,
          abTag,
        });
        continue;
      }
      // „Kündige Netflix" — kein Oberbegriff, aber ein konkretes Wort: die
      // übrigen Wörter des Teilsatzes werden zu Stichworten. Der FlowSelector
      // trifft ohnehin nur, was als Vertragsname existiert; nur Possessive
      // fliegen raus, damit „meine Wohnung kündige" nicht „meine" als
      // Konzeptnamen führt.
      const FUNKTIONSWORTE = ['mein', 'meine', 'meinen', 'unser', 'unsere', 'wuerde', 'moechte'];
      const worte = teilsatz.split(/[^a-z0-9а-яё]+/).filter((w) => w.length >= 4);
      const kandidaten = worte.filter(
        (w) =>
          !FUNKTIONSWORTE.includes(w) &&
          !SIGNALE.entfallen.some((s) => w.startsWith(s.split(' ')[0])),
      );
      if (kandidaten.length > 0) {
        deltas.push({ art: 'flow_entfaellt', konzept: kandidaten[0], stichworte: kandidaten, abTag });
        continue;
      }
    }
    if (betrag !== undefined && enthaelt(teilsatz, SIGNALE.monatlich)) {
      // Sparen BINDET Geld — für den verfügbaren Saldo ist es eine Ausgabe.
      // Einnahme ist nur echtes Zusatzeinkommen („verdiene 500 im Monat dazu").
      const richtung =
        !enthaelt(teilsatz, SIGNALE.sparen) && enthaelt(teilsatz, SIGNALE.einnahme)
          ? ('einnahme' as const)
          : ('ausgabe' as const);
      deltas.push({ art: 'flow_neu', betragProMonat: betrag, richtung, abTag });
      continue;
    }
    if (betrag !== undefined && zukunft.length > 0 && enthaelt(teilsatz, SIGNALE.einmalausgabe)) {
      const konzept = findeKonzeptImText(teilsatz, locale);
      deltas.push({ art: 'einmalausgabe', betrag, abTag, label: konzept?.konzept });
      continue;
    }
  }

  if (deltas.length === 0 && !schwelle) return null;
  return { deltas, schwelle };
}
