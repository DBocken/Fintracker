/**
 * Registereinträge der Anlass-Slice (Welle 2).
 *
 * Anlässe („Urlaub Italien", „Hochzeit") schneiden QUER durch die Kategorien:
 * Dieselbe Buchung liegt in „Restaurants" und gehört zum Urlaub. Deshalb ein
 * eigener Slot (`anlassId`) statt einer Kategorie — zwei Achsen zu einer zu
 * machen hiesse, eine davon zu verlieren.
 *
 * Der dritte Eintrag macht etwas sichtbar, das es längst gab und das nie
 * jemand zu sehen bekam: `suggestTransactionsForEvent` schlägt Buchungen im
 * Ereignisfenster vor. Der Chat rechnet dabei nichts Neues — er zeigt die
 * Vorschläge und verlinkt sie; **geschrieben wird nichts** (§3: Der Chat
 * schreibt nie aus eigener Deutung; Zuordnen bleibt Welle 5).
 */
import type { SpecialCategory, Transaction } from '@/types';
import type { ListenPosten, QuestionAnswer, QuestionData, QuestionEntry } from '@/lib/question-registry';
import { computeEventTotals } from '@/features/special-categories/domain/event-totals';
import { suggestTransactionsForEvent } from '@/features/special-categories/domain/assignment-suggestions';
import { toMajor } from '@/lib/money';
import type { Cents } from '@/lib/money';

/**
 * `SpecialCategoryTotal` führt rohe `number` in Cent, `toMajor` verlangt die
 * gebrandete `Cents`. Die Umdeutung steht EINMAL hier statt an jeder
 * Aufrufstelle — dieselbe Stelle, an der `EventTotalAmount` sie in der
 * Oberfläche vornimmt.
 */
function euro(minor: number): number {
  return toMajor(minor as Cents);
}

const KEIN_ANLASS: Omit<QuestionAnswer, 'aussage'> = {
  art: 'keine',
  wert: null,
  anzahl: 0,
  deepLink: '/special-categories',
  deepLinkArt: 'kontext',
};

function anlaesse(daten: QuestionData): SpecialCategory[] {
  return [...(daten.specialCategories ?? [])];
}

function totale(daten: QuestionData) {
  return computeEventTotals(
    anlaesse(daten),
    [...(daten.specialCategoryAssignments ?? [])],
    [...(daten.transactions ?? [])],
  );
}

const anlassKosten: QuestionEntry = {
  id: 'anlass.kosten',
  slots: { erforderlich: ['anlass'], optional: [] },
  // Bewusst DERSELBE Auslöser wie `ausgaben.gesamt`: „Was hat mich X
  // gekostet?" ist wörtlich dieselbe Frage — unterschieden wird sie durch den
  // erkannten ANLASS, nicht durch ein Zusatzwort. Ein eigenes Vokabular hätte
  // hier bedeutet, jede Formulierung zweimal zu pflegen und trotzdem an der
  // ersten ungewohnten zu scheitern; der Slot ist die belastbare Grenze
  // (er wiegt zwei Punkte, siehe `extrahiereEintragsSlots`).
  ausloeser: ['financeQuestions.trigger.ausgaben', 'financeQuestions.trigger.anlassKosten'],
  verstaerker: ['financeQuestions.trigger.anlass'],
  needs: ['specialCategories', 'transactions'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const anlass = anlaesse(daten).find((a) => a.id === slots.anlassId);
    if (!anlass) {
      return { ...KEIN_ANLASS, aussage: { key: 'financeQuestions.answer.anlassUnbekannt', params: {} } };
    }
    const summe = totale(daten).get(anlass.id);
    if (!summe || summe.transactionCount === 0) {
      return {
        ...KEIN_ANLASS,
        aussage: { key: 'financeQuestions.answer.anlassOhneBuchung', params: { name: anlass.name } },
        deepLink: `/special-categories?event=${encodeURIComponent(anlass.id)}`,
      };
    }

    // `subtreeMinor` statt `ownMinor`: Wer nach den Kosten der Hochzeit
    // fragt, meint die Flitterwochen mit. Ein Elternanlass, der seine
    // Kind-Anlässe unterschlägt, nennt eine Zahl, die niemand nachrechnen
    // kann.
    const begruendung =
      summe.subtreeMinor !== summe.ownMinor
        ? [
            {
              key: 'financeQuestions.reason.anlassTeilbaum',
              params: { direkt: euro(summe.ownMinor) },
            },
          ]
        : [];

    return {
      art: 'geld',
      wert: euro(summe.subtreeMinor),
      anzahl: summe.transactionCount,
      aussage: { key: 'financeQuestions.answer.anlassKosten', params: { name: anlass.name } },
      begruendung,
      deepLink: `/special-categories?event=${encodeURIComponent(anlass.id)}`,
      deepLinkArt: 'quelle',
    };
  },
};

const anlassListe: QuestionEntry = {
  id: 'anlass.liste',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.anlassListe'],
  verstaerker: ['financeQuestions.trigger.anlass'],
  needs: ['specialCategories', 'transactions'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const alle = anlaesse(daten).filter((a) => !a.archived);
    if (alle.length === 0) {
      return { ...KEIN_ANLASS, aussage: { key: 'financeQuestions.answer.anlassKeine', params: {} } };
    }
    const summen = totale(daten);
    // Nur oberste Ebene: Ein Kind-Anlass steckt bereits in der Teilbaum-Summe
    // seines Elternteils; beide zu listen zählte dieselben Euro zweimal.
    const posten: ListenPosten[] = alle
      .filter((a) => !a.parent_id)
      .map((a) => ({ label: a.name, betrag: euro(summen.get(a.id)?.subtreeMinor ?? 0) }))
      .filter((p) => p.betrag !== 0)
      .sort((a, b) => b.betrag - a.betrag);

    if (posten.length === 0) {
      return { ...KEIN_ANLASS, aussage: { key: 'financeQuestions.answer.anlassOhneKosten', params: {} } };
    }

    return {
      art: 'liste',
      wert: posten.reduce((s, p) => s + p.betrag, 0),
      anzahl: posten.length,
      posten: posten.slice(0, 10),
      aussage: { key: 'financeQuestions.answer.anlassListe', params: {} },
      deepLink: '/special-categories',
      deepLinkArt: 'quelle',
    };
  },
};

const anlassVorschlag: QuestionEntry = {
  id: 'anlass.vorschlag',
  slots: { erforderlich: ['anlass'], optional: [] },
  ausloeser: ['financeQuestions.trigger.anlassVorschlag'],
  verstaerker: ['financeQuestions.trigger.anlass'],
  needs: ['specialCategories', 'transactions'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const anlass = anlaesse(daten).find((a) => a.id === slots.anlassId);
    if (!anlass) {
      return { ...KEIN_ANLASS, aussage: { key: 'financeQuestions.answer.anlassUnbekannt', params: {} } };
    }
    if (!anlass.start_date) {
      // Ohne Zeitraum gibt es keine Heuristik — und geraten wird nicht.
      return {
        ...KEIN_ANLASS,
        aussage: { key: 'financeQuestions.answer.anlassOhneZeitraum', params: { name: anlass.name } },
        deepLink: `/special-categories?event=${encodeURIComponent(anlass.id)}`,
      };
    }

    const vorschlaege: Transaction[] = suggestTransactionsForEvent(
      anlass,
      [...(daten.transactions ?? [])],
      [...(daten.specialCategoryAssignments ?? [])],
      { today: daten.jetzt.toISOString().slice(0, 10) },
    );

    if (vorschlaege.length === 0) {
      return {
        ...KEIN_ANLASS,
        aussage: { key: 'financeQuestions.answer.anlassKeinVorschlag', params: { name: anlass.name } },
        deepLink: `/special-categories?event=${encodeURIComponent(anlass.id)}`,
      };
    }

    return {
      art: 'liste',
      wert: null,
      anzahl: vorschlaege.length,
      posten: vorschlaege.slice(0, 10).map((tx) => ({
        label: tx.payee || tx.description || tx.original_text,
        betrag: Math.abs(tx.amount),
      })),
      aussage: { key: 'financeQuestions.answer.anlassVorschlag', params: { name: anlass.name } },
      // Ausdrücklich: Vorschläge, keine Zuordnung. Zugeordnet wird auf der
      // Anlass-Fläche mit einem Klick — der Chat schreibt hier nichts.
      begruendung: [{ key: 'financeQuestions.reason.anlassVorschlagNichtZugeordnet', params: {} }],
      deepLink: `/special-categories?event=${encodeURIComponent(anlass.id)}`,
      deepLinkArt: 'kontext',
    };
  },
};

/**
 * Anlass-Befehl (Welle 5) — macht ausführbar, was Welle 2 nur anzeigen konnte.
 *
 * `anlassAnlegen` legt den Anlass an; `anlassZuordnen` hängt die Buchungen
 * daran, die `suggestTransactionsForEvent` vorschlägt — dieselbe Funktion,
 * die der Lese-Eintrag `anlass.vorschlag` benutzt. Zwei Wege zur selben
 * Vorschlagsmenge wären zwei Orte, an denen sie auseinanderlaufen kann.
 *
 * `antwort()` bleibt rein: Sie rechnet, WAS passieren würde, und legt den
 * Rückweg gleich mit fest.
 */
const anlassAktion: QuestionEntry = {
  id: 'anlass.aktion',
  slots: { erforderlich: [], optional: ['anlass'] },
  ausloeser: ['financeQuestions.trigger.anlassAktion'],
  needs: ['specialCategories', 'transactions'],
  aufwand: 'guenstig',
  nimmtAnlassAktion: true,
  antwort: (slots, daten): QuestionAnswer => {
    const absicht = slots.anlassAktion;
    if (!absicht) {
      return { ...KEIN_ANLASS, aussage: { key: 'financeQuestions.answer.anlassAktionUnklar', params: {} } };
    }

    if (absicht.art === 'anlegen') {
      const name = (absicht.anlassText ?? '').trim();
      if (!name) {
        return { ...KEIN_ANLASS, aussage: { key: 'financeQuestions.answer.anlassAktionOhneName', params: {} } };
      }
      // Ein Anlass mit gleichem Namen existiert bereits: Statt einen zweiten
      // anzulegen — der jede spätere Zuordnung mehrdeutig machte — wird das
      // gesagt.
      if (anlaesse(daten).some((a) => a.name.toLowerCase() === name.toLowerCase())) {
        return {
          ...KEIN_ANLASS,
          aussage: { key: 'financeQuestions.answer.anlassAktionSchonDa', params: { name } },
        };
      }
      return {
        art: 'aktion',
        wert: null,
        anzahl: 0,
        aktion: { art: 'anlassAnlegen', name, buchungen: [] },
        aussage: { key: 'financeQuestions.answer.anlassAktionAnlegen', params: { name } },
        deepLink: '/special-categories',
        deepLinkArt: 'kontext',
      };
    }

    const anlass = anlaesse(daten).find((a) => a.id === slots.anlassId);
    if (!anlass) {
      return { ...KEIN_ANLASS, aussage: { key: 'financeQuestions.answer.anlassUnbekannt', params: {} } };
    }
    if (!anlass.start_date) {
      return {
        ...KEIN_ANLASS,
        aussage: { key: 'financeQuestions.answer.anlassOhneZeitraum', params: { name: anlass.name } },
      };
    }

    const vorschlaege = suggestTransactionsForEvent(
      anlass,
      [...(daten.transactions ?? [])],
      [...(daten.specialCategoryAssignments ?? [])],
      { today: daten.jetzt.toISOString().slice(0, 10) },
    );

    if (vorschlaege.length === 0) {
      return {
        ...KEIN_ANLASS,
        aussage: { key: 'financeQuestions.answer.anlassKeinVorschlag', params: { name: anlass.name } },
      };
    }

    return {
      art: 'aktion',
      wert: null,
      anzahl: vorschlaege.length,
      aktion: {
        art: 'anlassZuordnen',
        name: anlass.name,
        anlassId: anlass.id,
        buchungen: vorschlaege.map((t) => String(t.id)),
      },
      posten: vorschlaege.slice(0, 10).map((tx) => ({
        label: tx.payee || tx.description || tx.original_text,
        betrag: Math.abs(tx.amount),
      })),
      aussage: {
        key: 'financeQuestions.answer.anlassAktionZuordnen',
        params: { name: anlass.name, anzahl: vorschlaege.length },
      },
      deepLink: `/special-categories?event=${encodeURIComponent(anlass.id)}`,
      deepLinkArt: 'kontext',
    };
  },
};

export const questions: readonly QuestionEntry[] = [
  anlassKosten,
  anlassListe,
  anlassVorschlag,
  anlassAktion,
];
