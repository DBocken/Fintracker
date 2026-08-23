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
import type { QuestionEntry } from '@/lib/question-registry';
import { totalOutstandingDebt, totalMinimumPayment } from '@/lib/debt-totals';

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
      aussage: {
        key: 'financeQuestions.answer.restschuld',
        params: { anzahl: offen.length },
      },
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
  antwort: (slots) => ({
    art: 'verweis',
    wert: slots.betrag ?? null,
    anzahl: 0,
    aussage: {
      key: 'financeQuestions.answer.leistbarkeitVerweis',
      params: { betrag: slots.betrag ?? 0 },
    },
    deepLink: '/liquidity?mode=simulation',
    deepLinkArt: 'kontext',
  }),
};

export const questions: readonly QuestionEntry[] = [schuldenRestschuld, leistbarkeitAnschaffung];
