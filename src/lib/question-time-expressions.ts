/**
 * Deutsche und englische Zeitausdrücke → aufgelöster Zeitraum.
 *
 * Liegt in `src/lib/`, weil der Matcher (`question-matcher.ts`) sie braucht
 * und der nichts aus `src/features/` importieren darf. Ergebnis ist ein
 * `ZeitraumSlot` mit einem `rangeToken`, wie ihn `encodeDashboardFilters`
 * erwartet — durchgereicht, nicht nachgebaut.
 *
 * **Die Wörter stehen bewusst HIER und nicht im Sprachbaum.** Ein i18n-Key ist
 * ein Ausgabetext; das hier sind Erkennungsdaten. Stünden sie in
 * `translations/`, erzwänge `locale-parity.test.ts` Parität für Wörter, die es
 * in einer Sprache gar nicht gibt — „letzten" hat im Russischen keine
 * Entsprechung als Einzelwort dieser Tabelle.
 *
 * **Benannte Grenze:** Für Russisch sind zunächst keine Ausdrücke hinterlegt.
 * Die Fläche antwortet dann „Zeitraum nicht erkannt" und fragt nach, statt zu
 * raten — eine falsche Zahl ist schlimmer als keine.
 */
import type { ZeitraumSlot } from '@/lib/question-registry';

/** Monatsnamen je Sprache, Index 0 = Januar. */
const MONATE: Record<string, readonly string[]> = {
  de: [
    'januar', 'februar', 'märz', 'maerz', 'april', 'mai', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'dezember',
  ],
  en: [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ],
};

/** „märz“ und „maerz“ zeigen auf denselben Monat — deshalb explizit gemappt. */
const MONATSINDEX: Record<string, Record<string, number>> = {
  de: {
    januar: 0, februar: 1, 'märz': 2, maerz: 2, april: 3, mai: 4, juni: 5,
    juli: 6, august: 7, september: 8, oktober: 9, november: 10, dezember: 11,
  },
  en: {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  },
};

/** Feste Wendungen je Sprache. */
const WENDUNGEN: Record<string, Record<string, string>> = {
  de: {
    'diesen monat': 'monat:0',
    'diesem monat': 'monat:0',
    'letzten monat': 'monat:-1',
    'vorigen monat': 'monat:-1',
    'dieses jahr': 'jahr:0',
    'diesem jahr': 'jahr:0',
    'letztes jahr': 'jahr:-1',
    'vorigen jahr': 'jahr:-1',
    'letzte woche': 'tage:7',
    'letzten 7 tage': 'tage:7',
    'letzten 30 tage': 'tage:30',
    'letzten 90 tage': 'tage:90',
    'insgesamt': 'gesamt',
    'gesamt': 'gesamt',
  },
  en: {
    'this month': 'monat:0',
    'last month': 'monat:-1',
    'this year': 'jahr:0',
    'last year': 'jahr:-1',
    'last week': 'tage:7',
    'last 7 days': 'tage:7',
    'last 30 days': 'tage:30',
    'last 90 days': 'tage:90',
    'overall': 'gesamt',
    'in total': 'gesamt',
    'all time': 'gesamt',
  },
};

const TAGE_TOKEN: Record<number, string> = { 7: '7d', 30: '30d', 90: '90d' };

function zweistellig(n: number): string {
  return String(n).padStart(2, '0');
}

function letzterTag(jahr: number, monatIndex: number): number {
  return new Date(Date.UTC(jahr, monatIndex + 1, 0)).getUTCDate();
}

function monatsSlot(jahr: number, monatIndex: number): ZeitraumSlot {
  const token = `${jahr}-${zweistellig(monatIndex + 1)}`;
  return {
    von: `${token}-01`,
    bis: `${token}-${zweistellig(letzterTag(jahr, monatIndex))}`,
    rangeToken: token,
    label: token,
  };
}

function jahresSlot(jahr: number): ZeitraumSlot {
  return {
    von: `${jahr}-01-01`,
    bis: `${jahr}-12-31`,
    rangeToken: String(jahr),
    label: String(jahr),
  };
}

function quartalsSlot(jahr: number, quartal: number): ZeitraumSlot {
  const ersterMonat = (quartal - 1) * 3;
  return {
    von: `${jahr}-${zweistellig(ersterMonat + 1)}-01`,
    bis: `${jahr}-${zweistellig(ersterMonat + 3)}-${zweistellig(letzterTag(jahr, ersterMonat + 2))}`,
    rangeToken: `${jahr}-Q${quartal}`,
    label: `${jahr}-Q${quartal}`,
  };
}

function isoTag(datum: Date): string {
  return datum.toISOString().slice(0, 10);
}

function tageSlot(tage: number, jetzt: Date): ZeitraumSlot {
  const von = new Date(jetzt.getTime() - tage * 24 * 60 * 60 * 1000);
  return {
    von: isoTag(von),
    bis: isoTag(jetzt),
    rangeToken: TAGE_TOKEN[tage] ?? '30d',
    label: `${tage}`,
  };
}

function gesamtSlot(jetzt: Date): ZeitraumSlot {
  return { von: '1970-01-01', bis: isoTag(jetzt), rangeToken: 'all', label: 'all' };
}

export interface ZeitraumTreffer {
  slot: ZeitraumSlot;
  /** Der erkannte Textausschnitt — damit der Matcher ihn nicht doppelt wertet. */
  treffer: string;
}

/**
 * Findet den ERSTEN Zeitausdruck im Text. Bewusst nicht mehrere: Zwei
 * Zeiträume in einer Frage sind mehrdeutig, und die Fläche fragt dann lieber
 * nach, als sich für einen zu entscheiden.
 */
export function parseZeitraum(text: string, locale: string, jetzt: Date): ZeitraumTreffer | null {
  const normalisiert = text.toLowerCase();
  const sprache = locale in WENDUNGEN ? locale : null;
  if (!sprache) return null;

  // 1. Feste Wendungen — längste zuerst, damit „letzten 30 tage" nicht von
  //    „letzten monat" verdrängt wird, falls beide Präfixe teilen.
  const wendungen = Object.keys(WENDUNGEN[sprache]).sort((a, b) => b.length - a.length);
  for (const wendung of wendungen) {
    if (!normalisiert.includes(wendung)) continue;
    const anweisung = WENDUNGEN[sprache][wendung];
    if (anweisung === 'gesamt') return { slot: gesamtSlot(jetzt), treffer: wendung };
    const [art, wert] = anweisung.split(':');
    if (art === 'monat') {
      const verschoben = new Date(Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth() + Number(wert), 1));
      return {
        slot: monatsSlot(verschoben.getUTCFullYear(), verschoben.getUTCMonth()),
        treffer: wendung,
      };
    }
    if (art === 'jahr') return { slot: jahresSlot(jetzt.getUTCFullYear() + Number(wert)), treffer: wendung };
    if (art === 'tage') return { slot: tageSlot(Number(wert), jetzt), treffer: wendung };
  }

  // 2. Quartal: „q2 2026", „2026-q2", „2. quartal 2026"
  const quartal = normalisiert.match(/\b(?:q([1-4])\s*(\d{4})|(\d{4})[-\s]*q([1-4]))\b/);
  if (quartal) {
    const q = Number(quartal[1] ?? quartal[4]);
    const jahr = Number(quartal[2] ?? quartal[3]);
    return { slot: quartalsSlot(jahr, q), treffer: quartal[0] };
  }

  // 3. Monatsname, optional mit Jahr: „im juli", „juli 2026"
  for (const name of MONATE[sprache] ?? []) {
    const stelle = normalisiert.indexOf(name);
    if (stelle < 0) continue;
    const monatIndex = MONATSINDEX[sprache][name];
    const rest = normalisiert.slice(stelle + name.length, stelle + name.length + 6);
    const jahrTreffer = rest.match(/\b(\d{4})\b/);
    if (jahrTreffer) {
      return { slot: monatsSlot(Number(jahrTreffer[1]), monatIndex), treffer: `${name} ${jahrTreffer[1]}` };
    }
    // Ohne Jahresangabe: der zuletzt VERGANGENE Monat dieses Namens. „Im
    // Juli" im Mai meint den Juli des Vorjahres, nicht einen, der noch
    // bevorsteht — nach dem läge nichts vor, worüber man Auskunft geben könnte.
    const jahr = monatIndex > jetzt.getUTCMonth() ? jetzt.getUTCFullYear() - 1 : jetzt.getUTCFullYear();
    return { slot: monatsSlot(jahr, monatIndex), treffer: name };
  }

  // 4. „letzte 45 tage" / „last 45 days" — freie Tageszahl.
  const tage = normalisiert.match(/\b(\d{1,3})\s*(tage|tagen|days)\b/);
  if (tage) return { slot: tageSlot(Number(tage[1]), jetzt), treffer: tage[0] };

  // 5. Blankes Jahr — zuletzt, damit „juli 2026" oben gewinnt.
  const jahr = normalisiert.match(/\b(20\d{2})\b/);
  if (jahr) return { slot: jahresSlot(Number(jahr[1])), treffer: jahr[1] };

  return null;
}
