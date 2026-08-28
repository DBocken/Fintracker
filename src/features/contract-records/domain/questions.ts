/**
 * Registereintrag der Verträge-Slice (WP-C).
 *
 * Rechnet nichts Neues: `computeContracts` leitet die Vertragszeilen ohnehin
 * ab, `yearlyEquivalent` macht aus Betrag und Zyklus die Jahressumme. Der
 * Eintrag verbindet beides und findet die Zeile über die Händlerfamilie.
 */
import type { QuestionAnswer, QuestionEntry } from '@/features/shared/domain/question-registry';
import { monatlicheFixkosten } from '@/lib/fixed-costs';
import { durchschnittlichesMonatsEinkommen } from '@/lib/income-stats';
import { isActiveForTotals } from '@/lib/contract-derivation';
import { computeContracts, yearlyEquivalent, monthlyEquivalent } from '@/lib/contract-derivation';
import { normalizeMerchantName } from '@/lib/merchant-normalization';
import { getUpcomingCharges } from '@/lib/upcoming-charges';
import { buildRecurringFlows } from '@/lib/forecast-flows';
import { jahresRuecklage } from '@/lib/annual-reserve';

const vertragJahreskosten: QuestionEntry = {
  id: 'vertrag.jahreskosten',
  slots: { erforderlich: ['haendler'], optional: [] },
  ausloeser: ['financeQuestions.trigger.vertrag', 'financeQuestions.trigger.kostetImJahr'],
  needs: ['transactions', 'categories', 'contractDecisions'],
  aufwand: 'guenstig',
  antwort: (slots, daten) => {
    const gesucht = normalizeMerchantName(slots.haendler) || (slots.haendler ?? '').toLowerCase().trim();
    const categoryMap = new Map((daten.categories ?? []).map((c) => [c.id, c]));
    const zeilen = computeContracts(
      [...(daten.transactions ?? [])],
      categoryMap,
      'Ausgabe',
      {
        decisions: new Map(daten.contractDecisions ?? []),
        now: daten.jetzt,
      },
    );

    const treffer = zeilen.find((zeile) => {
      const name = normalizeMerchantName(zeile.payee) || zeile.payee.toLowerCase().trim();
      return name.includes(gesucht);
    });

    // Deep-Link auf den VERTRAG selbst. Bis `/contracts` einen
    // `?merchant=`-Parameter bekam, musste hier ersatzweise die Buchungsliste
    // herhalten — also eine ANDERE Menge als die, aus der die Zahl stammt.
    // Jetzt öffnet der Link genau die Vertragszeile, die gerechnet wurde.
    //
    // Der normalisierte NAME und nicht der Fingerprint: `iban:de89…|out` wäre
    // eine IBAN in einer teilbaren URL.
    const deepLink = `/contracts?merchant=${encodeURIComponent(gesucht)}`;

    if (!treffer) {
      return {
        art: 'keine',
        wert: null,
        anzahl: 0,
        aussage: {
          key: 'financeQuestions.answer.vertragUnbekannt',
          params: { haendler: slots.haendler ?? '' },
        },
        deepLink,
        deepLinkArt: 'kontext',
        deepLinkLabelKey: 'financeQuestions.showContracts',
      };
    }

    const betrag = treffer.amountRecentTypical ?? treffer.amountTypical;

    return {
      art: 'geld',
      wert: yearlyEquivalent(betrag, treffer.cycle),
      anzahl: treffer.transactionIds.length,
      aussage: {
        key: 'financeQuestions.answer.vertragJahreskosten',
        params: { haendler: treffer.payee },
      },
      begruendung: [
        {
          key: 'financeQuestions.reason.vertragRhythmus',
          params: { monatlich: monthlyEquivalent(betrag, treffer.cycle) },
        },
      ],
      deepLink,
      // `kontext` und nicht `quelle`: Die Zahl ist die Jahresrechnung aus der
      // erkannten Serie, der Link zeigt die Vertragszeile. Das ist dieselbe
      // Sache, aber keine Buchungsmenge — die harte Invariante des Registers
      // prüft Buchungsmengen und liesse sich darauf nicht anwenden.
      deepLinkArt: 'kontext',
      deepLinkLabelKey: 'financeQuestions.showContract',
    };
  },
};

/** Aktive Ausgabe-Verträge — die gemeinsame Zeilenbasis der Abo-Familien. */
function aktiveVertraege(daten: Parameters<QuestionEntry['antwort']>[1]) {
  const categoryMap = new Map((daten.categories ?? []).map((c) => [c.id, c]));
  return computeContracts([...(daten.transactions ?? [])], categoryMap, 'Ausgabe', {
    decisions: new Map(daten.contractDecisions ?? []),
    now: daten.jetzt,
  }).filter((zeile) => isActiveForTotals(zeile));
}

const KEINE_VERTRAEGE = {
  art: 'keine',
  wert: null,
  anzahl: 0,
  deepLink: '/contracts',
  deepLinkArt: 'kontext',
  deepLinkLabelKey: 'financeQuestions.showContracts',
} satisfies Omit<QuestionAnswer, 'aussage'> & { art: 'keine'; wert: null };

/**
 * „Welche Abonnements habe ich?" — die Liste selbst ist die Antwort.
 *
 * `label` ist der Händlername aus den eigenen Buchungen (Nutzerdatum, kein
 * Bildschirmtext), `betrag` das Monatsäquivalent — roh, maskiert wird in der
 * Präsentation.
 */
const abosListe: QuestionEntry = {
  id: 'abos.liste',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.abos'],
  needs: ['transactions', 'categories', 'contractDecisions'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const zeilen = aktiveVertraege(daten);
    if (zeilen.length === 0) {
      return { ...KEINE_VERTRAEGE, aussage: { key: 'financeQuestions.answer.abosKeine', params: {} } };
    }

    const posten = zeilen
      .map((z) => ({
        label: z.payee,
        betrag: Math.abs(monthlyEquivalent(z.amountRecentTypical ?? z.amountTypical, z.cycle)),
      }))
      .sort((a, b) => b.betrag - a.betrag);

    return {
      art: 'liste',
      wert: posten.reduce((s, p) => s + p.betrag, 0),
      anzahl: posten.length,
      posten,
      aussage: { key: 'financeQuestions.answer.abosListe', params: { anzahl: posten.length } },
      deepLink: '/contracts',
      deepLinkArt: 'kontext',
      deepLinkLabelKey: 'financeQuestions.showContracts',
    };
  },
};

const abosSumme: QuestionEntry = {
  id: 'abos.summe',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.abos'],
  verstaerker: ['financeQuestions.trigger.zusammen'],
  needs: ['transactions', 'categories', 'contractDecisions'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const { summe, anzahl } = monatlicheFixkosten(aktiveVertraege(daten));
    if (anzahl === 0) {
      return { ...KEINE_VERTRAEGE, aussage: { key: 'financeQuestions.answer.abosKeine', params: {} } };
    }

    return {
      art: 'geld',
      wert: summe,
      anzahl,
      aussage: { key: 'financeQuestions.answer.abosSumme', params: { anzahl } },
      begruendung: [
        { key: 'financeQuestions.reason.abosJaehrlich', params: { betrag: summe * 12 } },
      ],
      deepLink: '/contracts',
      deepLinkArt: 'kontext',
      deepLinkLabelKey: 'financeQuestions.showContracts',
    };
  },
};

/**
 * „Welche Verträge sind teurer geworden?" — `changed`/`changeAmount` rechnet
 * die Vertragsableitung längst; hier wird nur gefiltert und gezeigt.
 */
const vertraegeTeurer: QuestionEntry = {
  id: 'vertraege.teurer',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.teurer'],
  verstaerker: ['financeQuestions.trigger.vertrag'],
  needs: ['transactions', 'categories', 'contractDecisions'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const teurer = aktiveVertraege(daten)
      .filter((z) => z.changed && z.changeAmount > 0)
      .map((z) => ({ label: z.payee, betrag: z.changeAmount }))
      .sort((a, b) => b.betrag - a.betrag);

    if (teurer.length === 0) {
      return {
        ...KEINE_VERTRAEGE,
        aussage: { key: 'financeQuestions.answer.vertraegeKeineTeurer', params: {} },
      };
    }

    return {
      art: 'liste',
      wert: teurer.reduce((s, p) => s + p.betrag, 0),
      anzahl: teurer.length,
      posten: teurer,
      aussage: { key: 'financeQuestions.answer.vertraegeTeurer', params: { anzahl: teurer.length } },
      deepLink: '/contracts',
      deepLinkArt: 'kontext',
      deepLinkLabelKey: 'financeQuestions.showContracts',
    };
  },
};

/**
 * Fixkosten — die Antwort NENNT ihre Definition (`reason.fixkostenDefinition`):
 * Eine Zahl, deren Definition niemand prüfen kann, wäre eine Behauptung
 * (AGENTS.md §3, „Was geschlossen wurde, wird geprüft").
 */
const fixkostenMonatlich: QuestionEntry = {
  id: 'fixkosten.monatlich',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.fixkosten'],
  // „pro Monat"/„monatlich" entscheidet gegen den Anteils-Geschwister —
  // Browser-Fund: ohne den Verstärker endete „Fixkosten pro Monat?" in der
  // Auswahl, obwohl die Frage eindeutig ist.
  verstaerker: ['financeQuestions.trigger.monatlichWort'],
  needs: ['transactions', 'categories', 'contractDecisions'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const { summe, anzahl } = monatlicheFixkosten(aktiveVertraege(daten));
    if (anzahl === 0) {
      return { ...KEINE_VERTRAEGE, aussage: { key: 'financeQuestions.answer.abosKeine', params: {} } };
    }

    return {
      art: 'geld',
      wert: summe,
      anzahl,
      aussage: { key: 'financeQuestions.answer.fixkostenMonat', params: { anzahl } },
      begruendung: [{ key: 'financeQuestions.reason.fixkostenDefinition', params: {} }],
      deepLink: '/contracts',
      deepLinkArt: 'kontext',
      deepLinkLabelKey: 'financeQuestions.showContracts',
    };
  },
};

const fixkostenAnteil: QuestionEntry = {
  id: 'fixkosten.anteil',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.fixkosten'],
  verstaerker: ['financeQuestions.trigger.anteil'],
  needs: ['transactions', 'categories', 'contractDecisions'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const { summe, anzahl } = monatlicheFixkosten(aktiveVertraege(daten));
    const einkommen = durchschnittlichesMonatsEinkommen([...(daten.transactions ?? [])], daten.jetzt);

    // „Kein Einkommen erfasst" ist eine ANDERE Aussage als „Anteil 0 %".
    if (anzahl === 0 || einkommen === null || einkommen <= 0) {
      return {
        ...KEINE_VERTRAEGE,
        aussage: { key: 'financeQuestions.answer.fixkostenKeinAnteil', params: {} },
      };
    }

    return {
      art: 'quote',
      wert: summe / einkommen,
      anzahl,
      aussage: { key: 'financeQuestions.answer.fixkostenAnteil', params: {} },
      begruendung: [
        {
          key: 'financeQuestions.reason.anteilZahlen',
          params: { betrag: summe, monatlich: einkommen },
        },
        { key: 'financeQuestions.reason.fixkostenDefinition', params: {} },
      ],
      deepLink: '/contracts',
      deepLinkArt: 'kontext',
      deepLinkLabelKey: 'financeQuestions.showContracts',
    };
  },
};

/**
 * „Was wird demnächst abgebucht?" — die Fälligkeiten der nächsten 30 Tage.
 *
 * Gerechnet mit `getUpcomingCharges` über die abgeleiteten Verträge, also mit
 * derselben Liste, die auch der Coach und die Liquiditätsfläche zeigen.
 *
 * Nur AUSGABEN: Gefragt ist, was vom Konto geht. Eingänge dazwischen zu
 * mischen machte die Liste länger und die Antwort unklarer — und die Frage
 * nach dem nächsten Geldeingang hat mit `verfuegbar.bisGehalt` ihre eigene
 * Familie.
 */
const abbuchungNaechste: QuestionEntry = {
  id: 'abbuchung.naechste',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.naechsteAbbuchung'],
  needs: ['transactions', 'categories', 'contractDecisions'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const heute = daten.jetzt.toISOString().slice(0, 10);
    const zeilen = computeContracts(
      [...(daten.transactions ?? [])],
      new Map((daten.categories ?? []).map((c) => [c.id, c])),
      'Ausgabe',
      { decisions: new Map(daten.contractDecisions ?? []), now: daten.jetzt },
    );
    const faellig = getUpcomingCharges(buildRecurringFlows(zeilen), {
      fromISO: heute,
      horizonDays: 30,
    }).filter((c) => c.direction === 'expense');

    if (faellig.length === 0) {
      return {
        art: 'anzahl',
        wert: 0,
        anzahl: 0,
        aussage: { key: 'financeQuestions.answer.abbuchungKeine', params: {} },
        deepLink: '/contracts',
        deepLinkArt: 'kontext',
      };
    }

    return {
      art: 'liste',
      wert: faellig.reduce((summe, c) => summe + Math.abs(c.amount), 0),
      anzahl: faellig.length,
      posten: faellig.slice(0, 10).map((c) => ({ label: c.name, betrag: Math.abs(c.amount) })),
      aussage: {
        key: 'financeQuestions.answer.abbuchungNaechste',
        params: { datum: faellig[0].dateISO },
      },
      deepLink: '/contracts',
      deepLinkArt: 'kontext',
    };
  },
};

/**
 * „Wie viel muss ich monatlich für die Jahresrechnungen zurücklegen?" (Welle 4).
 *
 * Die Frage stand in ZWEI Korpora als Lücke, und in Welle 3 musste der
 * Auslöser von `ziel.sparrate` eigens verengt werden, damit er nicht danach
 * griff — er hätte nach einem Zielbetrag gefragt, den der Fragende gar nicht
 * hat. Genau das ist der Unterschied: Bei der Zielrückrechnung NENNT jemand
 * einen Betrag, hier ergibt er sich aus dem Bestand.
 *
 * #333 verlangte dafür ein neues Sparziel-Datenmodell. Gebraucht wird keines:
 * Die Vertragsableitung kennt die Zyklen, `jahresRuecklage` verteilt sie auf
 * Monate. Ein eigenes Ziel bleibt für Vorhaben sinnvoll, die in keiner
 * Buchung stehen — dafür gibt es `SinkingFund`.
 */
const ruecklageJahresrechnungen: QuestionEntry = {
  id: 'ruecklage.jahresrechnungen',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.ruecklageJahr'],
  verstaerker: ['financeQuestions.trigger.abos'],
  needs: ['transactions', 'categories', 'contractDecisions'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const ruecklage = jahresRuecklage(aktiveVertraege(daten));

    if (ruecklage.posten.length === 0) {
      return {
        ...KEINE_VERTRAEGE,
        aussage: { key: 'financeQuestions.answer.ruecklageKeine', params: {} },
      };
    }

    return {
      art: 'liste',
      wert: ruecklage.monatlich,
      anzahl: ruecklage.posten.length,
      // Die Zeilen tragen den ANTEIL an der Monatsrücklage, nicht den
      // Rechnungsbetrag: Wer 1.200 € im Jahr zahlt, legt 100 € im Monat
      // zurück, und danach ist gefragt.
      posten: ruecklage.posten.map((p) => ({ label: p.name, betrag: p.monatlich })),
      aussage: {
        key: 'financeQuestions.answer.ruecklageJahr',
        params: { anzahl: ruecklage.posten.length },
      },
      begruendung: [
        { key: 'financeQuestions.reason.ruecklageProJahr', params: { betrag: ruecklage.proJahr } },
      ],
      deepLink: '/contracts',
      deepLinkArt: 'kontext',
      deepLinkLabelKey: 'financeQuestions.showContracts',
    };
  },
};

export const questions: readonly QuestionEntry[] = [
  ruecklageJahresrechnungen,
  vertragJahreskosten,
  abosListe,
  abosSumme,
  vertraegeTeurer,
  fixkostenMonatlich,
  fixkostenAnteil,
  abbuchungNaechste,
];
