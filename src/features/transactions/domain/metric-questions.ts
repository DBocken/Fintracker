/**
 * Kennzahl- und Vergleichs-Einträge der Buchungen-Slice (Welle 1).
 *
 * Der Befund, der diese Datei nötig macht: Der Auftrag verlangt 1.000
 * Nutzerfragen quer durch 25 Themen — aber es sind nicht 1.000 Absichten.
 * „Was kostet mich mein Auto im Monat?", „Wie viel gebe ich für Essen im
 * Monat aus?" und „Was kostet mich Wohnen im Monat?" sind EINE Frage auf
 * drei Bezugsgrößen. Was sich unterscheidet, ist nicht das Thema, sondern
 * die RECHENART.
 *
 * Deshalb liegt hier je Rechenart ein Eintrag, nicht je Thema:
 * Monatsdurchschnitt, Anteil, Durchschnitt je Vorgang, Extremwert, Trend —
 * plus drei Vergleiche (Händler, Kategorie, Zeitraum). Die Bezugsgröße
 * kommt aus den vorhandenen Slots, die Oberbegriffe („Auto", „Essen") löst
 * WP-G bereits in Kategorienmengen auf.
 *
 * Gerechnet wird nichts hier: Die Kennzahlen sind reine Funktionen in
 * `lib/spending-metrics.ts`, die Filterung ist `filterTransactions`. Diese
 * Datei ist Verdrahtung — und hält die Invariante des Registers ein: Die
 * Menge hinter `wert` ist exakt die Menge hinter `deepLink`.
 */
import type {
  QuestionAnswer,
  QuestionData,
  QuestionEntry,
  QuestionSlots,
} from '@/lib/question-registry';
import type { Transaction } from '@/types';
import { filterTransactions, buildTransactionsHref } from '@/features/shared/domain/dashboard-filtering';
import {
  anteilAnGesamt,
  durchschnittJeVorgang,
  extremwertMonat,
  extremwertVorgang,
  monateImBestand,
  monateZwischen,
  monatsDurchschnitt,
  monatsReihe,
  trendRichtung,
  vergleicheMengen,
} from '@/lib/spending-metrics';
import { erlaubteSlots, filterAusSlots, vollstaendig } from './question-filters';

/** Die Menge, auf die sich eine Frage bezieht — Filter und Ergebnis in einem. */
interface Bezugsmenge {
  transactions: Transaction[];
  deepLink: string;
}

function mengeFuer(
  entry: Pick<QuestionEntry, 'slots'>,
  slots: QuestionSlots,
  daten: QuestionData,
): Bezugsmenge {
  const teilFilter = filterAusSlots(slots, erlaubteSlots(entry));
  return {
    transactions: filterTransactions(
      [...(daten.transactions ?? [])],
      [...(daten.categories ?? [])],
      [...(daten.accounts ?? [])],
      vollstaendig(teilFilter),
      daten.jetzt,
    ),
    deepLink: buildTransactionsHref(teilFilter),
  };
}

/**
 * Beschriftung der Bezugsgröße für die Antwort — NUTZERDATUM (Händlername,
 * Kategoriename), kein Bildschirmtext. Leer, wenn die Frage keine Größe
 * nannte; die Aussage sagt dann „insgesamt".
 */
function labelFuer(slots: QuestionSlots, daten: QuestionData): string {
  if (slots.haendler) return slots.haendler;
  const ids = slots.kategorieIds ?? [];
  if (ids.length > 0) {
    const namen = new Map((daten.categories ?? []).map((c) => [c.id, c.name]));
    return ids.map((id) => namen.get(id) ?? id).join(' · ');
  }
  return '';
}

/** Alle Rechenart-Einträge teilen diese Slot-Freiheit: jede Achse darf, keine muss. */
const FREIE_BEZUGSGROESSE = {
  erforderlich: [],
  optional: ['kategorie', 'haendler', 'konto', 'zeitraum'],
} as const;

/**
 * „Was kostet mich X im Monat?" — Summe auf die abgedeckten KALENDERMONATE
 * verteilt, nicht auf die Monate mit Buchungen (Begründung in
 * `spending-metrics.ts`).
 */
const ausgabenDurchschnitt: QuestionEntry = {
  id: 'ausgaben.durchschnitt',
  slots: FREIE_BEZUGSGROESSE,
  // Der Monatsdurchschnitt beantwortet keine Frage nach einer anderen
  // Bezugsperiode — „pro Nutzung", „pro Woche" schliessen ihn aus.
  normiertAufMonat: true,
  ausloeser: ['financeQuestions.trigger.proMonatSchnitt'],
  verstaerker: ['financeQuestions.trigger.ausgaben', 'financeQuestions.trigger.kostet'],
  needs: ['transactions', 'categories', 'accounts'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const menge = mengeFuer(ausgabenDurchschnitt, slots, daten);
    // Der Nenner ist der BEOBACHTUNGSZEITRAUM: der gefragte Zeitraum, sonst
    // die Spanne des ganzen Bestands. Über die eigenen Buchungen gerechnet
    // käme eine zu hohe Zahl heraus — wer selten tankt, tankt trotzdem über
    // das ganze Jahr verteilt.
    const monate = slots.zeitraum
      ? monateZwischen(slots.zeitraum.von, slots.zeitraum.bis)
      : monateImBestand(daten.transactions ?? []);
    const wert = monatsDurchschnitt(menge.transactions, monate);
    return {
      art: 'geld',
      wert,
      anzahl: menge.transactions.length,
      aussage: {
        key: wert === null
          ? 'financeQuestions.answer.durchschnittKeiner'
          : 'financeQuestions.answer.durchschnittMonat',
        params: { bezug: labelFuer(slots, daten) },
      },
      deepLink: menge.deepLink,
      deepLinkArt: 'quelle',
    };
  },
};

/** „Welchen Anteil meiner Ausgaben macht X aus?" */
const ausgabenAnteil: QuestionEntry = {
  id: 'ausgaben.anteil',
  slots: { erforderlich: [], optional: ['kategorie', 'haendler', 'zeitraum'] },
  ausloeser: ['financeQuestions.trigger.anteilAn'],
  verstaerker: ['financeQuestions.trigger.ausgaben'],
  needs: ['transactions', 'categories', 'accounts'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const teil = mengeFuer(ausgabenAnteil, slots, daten);
    // Die Gesamtmenge trägt DENSELBEN Zeitraum, aber keine Bezugsgröße —
    // sonst verglichen wir den Teil mit sich selbst.
    const gesamt = mengeFuer(
      { slots: { erforderlich: [], optional: ['zeitraum'] } },
      { zeitraum: slots.zeitraum },
      daten,
    );
    const quote = anteilAnGesamt(teil.transactions, gesamt.transactions);
    return {
      art: 'quote',
      wert: quote,
      anzahl: teil.transactions.length,
      aussage: {
        key: quote === null
          ? 'financeQuestions.answer.anteilKeiner'
          : 'financeQuestions.answer.anteilAnAusgaben',
        params: { bezug: labelFuer(slots, daten), zeitraum: slots.zeitraum?.label ?? '' },
      },
      deepLink: teil.deepLink,
      deepLinkArt: 'quelle',
    };
  },
};

/** „Wie hoch war mein durchschnittlicher Einkauf bei X?" — Summe je VORGANG. */
const ausgabenJeVorgang: QuestionEntry = {
  id: 'ausgaben.jeVorgang',
  slots: FREIE_BEZUGSGROESSE,
  ausloeser: ['financeQuestions.trigger.jeEinkauf'],
  verstaerker: ['financeQuestions.trigger.ausgaben'],
  needs: ['transactions', 'categories', 'accounts'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const menge = mengeFuer(ausgabenJeVorgang, slots, daten);
    const wert = durchschnittJeVorgang(menge.transactions);
    return {
      art: 'geld',
      wert,
      anzahl: menge.transactions.length,
      aussage: {
        key: wert === null
          ? 'financeQuestions.answer.jeVorgangKeiner'
          : 'financeQuestions.answer.jeVorgang',
        params: { bezug: labelFuer(slots, daten) },
      },
      deepLink: menge.deepLink,
      deepLinkArt: 'quelle',
    };
  },
};

/**
 * „Welcher Monat war am teuersten?" bzw. „Was war mein teuerster Einkauf?"
 *
 * Beide Lesarten in einem Eintrag: Sie unterscheiden sich nur darin, ob der
 * Extremwert über MONATE oder über VORGÄNGE gesucht wird — und das steht
 * im Fragetext („Monat" bzw. „Einkauf/Zahlung"). Zwei Einträge dafür
 * teilten sich sämtliche Auslöser und erzeugten nur Gleichstand.
 */
const ausgabenExtremwert: QuestionEntry = {
  id: 'ausgaben.extremwert',
  slots: FREIE_BEZUGSGROESSE,
  ausloeser: ['financeQuestions.trigger.teuerster'],
  verstaerker: ['financeQuestions.trigger.ausgaben', 'financeQuestions.trigger.monatWort'],
  needs: ['transactions', 'categories', 'accounts'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const menge = mengeFuer(ausgabenExtremwert, slots, daten);
    // Ohne Monatswort ist der teuerste EINKAUF gemeint; die Frage nach dem
    // Monat nennt ihn ausdrücklich.
    const monat = extremwertMonat(menge.transactions);
    const vorgang = extremwertVorgang(menge.transactions);
    const treffer = monat ?? vorgang;
    return {
      art: 'geld',
      wert: treffer?.betrag ?? null,
      anzahl: menge.transactions.length,
      posten: treffer && vorgang
        ? [{ label: vorgang.label ?? '', betrag: vorgang.betrag, monatIso: monat?.bezug }]
        : undefined,
      aussage: {
        key: treffer === null
          ? 'financeQuestions.answer.extremwertKeiner'
          : 'financeQuestions.answer.extremwertMonat',
        params: { bezug: labelFuer(slots, daten), monat: monat?.bezug ?? '' },
      },
      deepLink: menge.deepLink,
      deepLinkArt: 'quelle',
    };
  },
};

/** „Wie haben sich meine Ausgaben für X entwickelt?" — Richtung, keine Steigung. */
const ausgabenTrend: QuestionEntry = {
  id: 'ausgaben.trend',
  slots: FREIE_BEZUGSGROESSE,
  ausloeser: ['financeQuestions.trigger.entwicklung'],
  verstaerker: ['financeQuestions.trigger.ausgaben'],
  needs: ['transactions', 'categories', 'accounts'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const menge = mengeFuer(ausgabenTrend, slots, daten);
    const reihe = monatsReihe(menge.transactions);
    const trend = trendRichtung(reihe);
    return {
      art: 'liste',
      // KEIN Wert oben: `art: 'liste'` trägt bei den Bestandseinträgen einen
      // BETRAG (Top-Händler, Top-Kategorien), und die Präsentation
      // formatiert ihn als Geld. Eine Quote an derselben Stelle käme als
      // Euro-Betrag auf den Bildschirm. Die Richtung steht in der Aussage,
      // die Beträge stehen in der Reihe.
      wert: null,
      anzahl: reihe.length,
      posten: reihe.map((p) => ({ label: '', betrag: p.betrag, monatIso: p.monat })),
      aussage: {
        key: trend === null
          ? 'financeQuestions.answer.trendZuKurz'
          : trend.richtung === 'steigend'
            ? 'financeQuestions.answer.trendSteigend'
            : trend.richtung === 'fallend'
              ? 'financeQuestions.answer.trendFallend'
              : 'financeQuestions.answer.trendStabil',
        params: {
          bezug: labelFuer(slots, daten),
          anzahl: reihe.length,
          prozent: trend ? Math.abs(Math.round(trend.quote * 100)) : 0,
        },
      },
      deepLink: menge.deepLink,
      deepLinkArt: 'quelle',
    };
  },
};

/**
 * Die drei Vergleiche. Sie teilen die ganze Mechanik und unterscheiden sich
 * nur darin, WELCHE Achse der zweite Partner belegt — deshalb eine
 * Fabrik statt dreimal derselbe Rumpf.
 */
function vergleichsEintrag(
  id: string,
  achse: 'haendler' | 'kategorie' | 'zeitraum',
  ausloeserKey: string,
): QuestionEntry {
  const entry: QuestionEntry = {
    id,
    slots: FREIE_BEZUGSGROESSE,
    ausloeser: [ausloeserKey],
    verstaerker: ['financeQuestions.trigger.ausgaben'],
    needs: ['transactions', 'categories', 'accounts'],
    aufwand: 'guenstig',
    nimmtVergleich: achse,
    antwort: (slots, daten): QuestionAnswer => {
      const menge = mengeFuer(entry, slots, daten);

      // Die Referenzmenge entsteht aus DENSELBEN Slots, nur mit dem
      // Vergleichspartner an der Stelle der Hauptgröße — sonst verglichen
      // wir zwei verschieden gefilterte Mengen und nennten es Vergleich.
      const partner = slots.vergleich;
      const referenzSlots: QuestionSlots =
        partner?.art === 'haendler'
          ? { ...slots, haendler: partner.haendler }
          : partner?.art === 'kategorie'
            ? { ...slots, kategorieIds: partner.kategorieIds }
            : partner?.art === 'zeitraum'
              ? { ...slots, zeitraum: partner.zeitraum }
              : slots;
      const referenzmenge = mengeFuer(entry, referenzSlots, daten);
      const ergebnis = vergleicheMengen(menge.transactions, referenzmenge.transactions);

      const labelReferenz =
        partner?.art === 'zeitraum'
          ? partner.zeitraum.label
          : labelFuer(referenzSlots, daten);

      return {
        art: 'vergleich',
        wert: ergebnis.wert,
        anzahl: menge.transactions.length,
        vergleich: {
          labelWert: partner?.art === 'zeitraum' ? slots.zeitraum?.label ?? '' : labelFuer(slots, daten),
          labelReferenz,
          referenz: ergebnis.referenz,
          differenz: ergebnis.differenz,
          quote: ergebnis.quote,
        },
        aussage: {
          key: ergebnis.differenz === 0
            ? 'financeQuestions.answer.vergleichGleich'
            : ergebnis.differenz > 0
              ? 'financeQuestions.answer.vergleichMehr'
              : 'financeQuestions.answer.vergleichWeniger',
          params: {},
        },
        // Verlinkt wird die HAUPT-Menge; die Referenz ist Bezugsgröße, nicht
        // Auskunft — ein Link auf beide gleichzeitig gibt es nicht.
        deepLink: menge.deepLink,
        deepLinkArt: 'quelle',
      };
    },
  };
  return entry;
}

export const metricQuestions: readonly QuestionEntry[] = [
  ausgabenDurchschnitt,
  ausgabenAnteil,
  ausgabenJeVorgang,
  ausgabenExtremwert,
  ausgabenTrend,
  vergleichsEintrag('vergleich.haendler', 'haendler', 'financeQuestions.trigger.vergleichHaendler'),
  vergleichsEintrag('vergleich.kategorie', 'kategorie', 'financeQuestions.trigger.vergleichKategorie'),
  vergleichsEintrag('vergleich.zeitraum', 'zeitraum', 'financeQuestions.trigger.vergleichZeitraum'),
];
