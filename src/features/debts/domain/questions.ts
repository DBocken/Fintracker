/**
 * Registereinträge der Schulden-Slice (WP-C).
 *
 * Zwei Dinge sind hier besonders:
 *
 * 1. **Der Sanfte Modus.** Ein Schuldenstand ist genau die Zahl, für die
 *    `docs/debt-avoidance-recovery.md` das Maskieren vorsieht. Der Eintrag
 *    liefert deshalb — wie jeder andere — eine ROHE Zahl; maskiert wird in der
 *    Präsentation über `money.mask`. Gäbe er einen formatierten Betrag
 *    zurück, umginge er den Sanften Modus an einer Stelle, die
 *    `check:money-format` per Konstruktion nicht sieht (`src/lib/` hat keinen
 *    React-Kontext).
 * 2. **`leistbarkeit.anschaffung` rechnet NICHT.** `evaluateAffordability` ist
 *    eine inverse Monte-Carlo-Suche und läuft im Worker — weder günstig noch
 *    synchron. Sie pro Tastendruck auszuführen wäre die Fläche, die beim
 *    Tippen einfriert. Genau dafür gibt es `aufwand: 'teuer'` und
 *    `art: 'verweis'`: Der Eintrag liest den Betrag und gibt einen
 *    vorbelegten Deep-Link zurück. Das hält `antwort()` ausnahmslos rein —
 *    die Eigenschaft, an der die Testbarkeit des ganzen Registers hängt.
 */
import type { QuestionAnswer, QuestionEntry } from '@/lib/question-registry';
import { totalOutstandingDebt, totalMinimumPayment } from '@/lib/debt-totals';
import { offeneRatenJeHaendler } from '@/lib/installments';
import { buildTransactionsHref } from '@/features/shared/domain/dashboard-filtering';

const schuldenRestschuld: QuestionEntry = {
  id: 'schulden.restschuld',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.schulden', 'financeQuestions.trigger.restschuld'],
  needs: ['debts'],
  aufwand: 'guenstig',
  antwort: (_slots, daten) => {
    const schulden = [...(daten.debts ?? [])];
    const offen = schulden.filter((d) => !d.is_paid_off);

    return {
      art: 'geld',
      wert: totalOutstandingDebt(schulden),
      anzahl: offen.length,
      aussage: { key: 'financeQuestions.answer.restschuld', params: {} },
      begruendung: [
        {
          key: 'financeQuestions.reason.mindestraten',
          params: { betrag: totalMinimumPayment(schulden) },
        },
      ],
      deepLink: '/debts',
      deepLinkArt: 'kontext',
    };
  },
};

const leistbarkeitAnschaffung: QuestionEntry = {
  id: 'leistbarkeit.anschaffung',
  slots: { erforderlich: ['betrag'], optional: ['zeitraum'] },
  ausloeser: ['financeQuestions.trigger.leistbarkeit'],
  needs: [],
  aufwand: 'teuer',
  // Die Simulation ist die einzige Funktion, die veränderte Welten rechnet —
  // deshalb darf NUR dieser Eintrag hypothetische Fragen nehmen.
  beantwortetSzenarien: true,
  antwort: (slots) => ({
    art: 'verweis',
    wert: slots.betrag ?? null,
    anzahl: 0,
    aussage: {
      key: 'financeQuestions.answer.leistbarkeitVerweis',
      params: { betrag: slots.betrag ?? 0 },
    },
    // Der Betrag reist im Link mit (WP-H.5): `LiquidityReport` liest ihn und
    // belegt „Frag dein Geld" vor — der Antworttext verspricht genau das,
    // und bis WP-H las diese Parameter schlicht niemand.
    deepLink:
      slots.betrag !== undefined
        ? `/liquidity?mode=simulation&betrag=${slots.betrag}`
        : '/liquidity?mode=simulation',
    deepLinkArt: 'kontext',
  }),
};

/**
 * „Wie viele Raten habe ich noch?"
 *
 * Der Eintrag ist der Beleg dafür, dass die Bauform trägt: Die Fachlogik
 * (Muster lesen, Restlaufzeit rechnen) liegt als reine Funktion in
 * `src/lib/installments.ts`, der Eintrag daneben ist reine Verdrahtung. Die
 * Chat-Fläche wurde dafür nicht angefasst.
 *
 * Die Restlaufzeit wird GERECHNET, nicht gelesen: Aus „Rate 3 von 12" folgt
 * `12 − 3 = 9`. Genau an dieser Grenze verläuft die Arbeitsteilung — ein
 * Muster zu erkennen ist Mustererkennung, `12 − 3` ist Arithmetik, und
 * Arithmetik wird nicht geschätzt.
 *
 * `deepLinkArt: 'kontext'`: Der Link zeigt alle Buchungen des Händlers, die
 * Zahl stammt aber aus genau EINER — der jüngsten. Diese Entfernung zu
 * benennen ist ehrlicher, als die Zahl passend zu biegen.
 */
const ratenOffen: QuestionEntry = {
  id: 'raten.offen',
  slots: { erforderlich: [], optional: ['haendler'] },
  ausloeser: ['financeQuestions.trigger.raten'],
  needs: ['transactions'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const alle = offeneRatenJeHaendler(daten.transactions ?? []);
    const raten = slots.haendler ? alle.filter((r) => r.haendler === slots.haendler) : alle;
    const erste = raten[0];

    if (!erste) {
      return {
        art: 'keine',
        wert: null,
        anzahl: 0,
        aussage: { key: 'financeQuestions.answer.ratenKeine', params: {} },
        deepLink: '/debts',
        deepLinkArt: 'kontext',
      };
    }

    return {
      art: 'anzahl',
      wert: erste.offen,
      anzahl: raten.length,
      aussage: {
        key: 'financeQuestions.answer.ratenOffen',
        params: { haendler: erste.anzeigename, offen: erste.offen, gesamt: erste.gesamt },
      },
      begruendung: [
        {
          key: 'financeQuestions.reason.ratenMonatlich',
          params: { monatlich: erste.monatlich, rest: erste.monatlich * erste.offen },
        },
        { key: 'financeQuestions.reason.ratenBeleg', params: { beleg: erste.beleg } },
      ],
      deepLink: buildTransactionsHref({ merchant: erste.haendler }),
      deepLinkArt: 'kontext',
    };
  },
};

export const questions: readonly QuestionEntry[] = [
  schuldenRestschuld,
  leistbarkeitAnschaffung,
  ratenOffen,
];
