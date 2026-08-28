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
import type {
  QuestionAnswer,
  QuestionData,
  QuestionEntry,
  QuestionSlots,
} from '@/features/shared/domain/question-registry';
import { calculatePayoffPlan, MAX_TILGUNGS_MONATE } from '@/lib/debt-payoff';
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
  // Hypothetische Fragen dürfen nur Einträge nehmen, die die veränderte Welt
  // tatsächlich RECHNEN. Bis Welle 3 war das allein die Simulation; seither
  // gehört `schulden.sondertilgung` dazu (deterministischer Tilgungsplan mit
  // anderem Budget). Was das Gate abwehrt, ist unverändert: eine
  // Bestandsauswertung, die eine Frage über eine andere Welt mit Ist-Zahlen
  // beantwortet.
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

/**
 * Zielrückrechnung (Welle 3) — die Umkehrung der Leistbarkeit.
 *
 * `leistbarkeit.anschaffung` nimmt einen Betrag und fragt „geht das?".
 * Diese beiden fragen andersherum: Der gesuchte Wert IST die Antwort —
 * die zulässige Obergrenze bzw. die nötige monatliche Rate.
 *
 * Beide sind `teuer` und tragen deshalb nur die FRAGE, keine Zahl:
 * Gerechnet wird über eine Binärsuche mit hunderten Simulationsläufen, und
 * die gehört nicht in eine reine, synchrone `antwort()` — dieselbe
 * Arbeitsteilung wie bei `szenario.kombination` (WP-H).
 *
 * Beide beantworten Szenarien: Sie reden ausdrücklich über eine veränderte
 * Welt, und die Simulation ist die einzige Funktion, die eine solche rechnet.
 */
const HORIZONT_TAGE = 90;

const zielObergrenze: QuestionEntry = {
  id: 'ziel.obergrenze',
  slots: { erforderlich: [], optional: ['zeitraum'] },
  ausloeser: ['financeQuestions.trigger.zielObergrenze'],
  needs: [],
  aufwand: 'teuer',
  beantwortetSzenarien: true,
  antwort: (slots, daten) => ({
    art: 'zielrueckrechnung',
    wert: null,
    anzahl: 0,
    aussage: { key: 'financeQuestions.answer.zielObergrenze', params: {} },
    ziel: { art: 'obergrenze', inTagen: tageBis(slots, daten.jetzt, HORIZONT_TAGE) },
    deepLink: '/liquidity?mode=simulation',
    deepLinkArt: 'kontext',
  }),
};

const zielSparrate: QuestionEntry = {
  id: 'ziel.sparrate',
  // Der Betrag ist hier PFLICHT — anders als bei der Obergrenze, wo er das
  // Gesuchte ist. „Wie viel muss ich sparen?" ohne Ziel ist keine Frage,
  // sondern eine halbe.
  slots: { erforderlich: ['betrag'], optional: ['zeitraum'] },
  ausloeser: ['financeQuestions.trigger.zielSparrate'],
  needs: [],
  aufwand: 'teuer',
  beantwortetSzenarien: true,
  antwort: (slots, daten) => ({
    art: 'zielrueckrechnung',
    wert: slots.betrag ?? null,
    anzahl: 0,
    aussage: {
      key: 'financeQuestions.answer.zielSparrate',
      params: { betrag: slots.betrag ?? 0 },
    },
    ziel: { art: 'sparrate', betrag: slots.betrag, inTagen: tageBis(slots, daten.jetzt, HORIZONT_TAGE) },
    deepLink:
      slots.betrag !== undefined
        ? `/liquidity?mode=simulation&betrag=${slots.betrag}`
        : '/liquidity?mode=simulation',
    deepLinkArt: 'kontext',
  }),
};

/**
 * Tage bis zum Ziel aus einem erkannten Zeitraum — sonst der Vorgabe-Horizont.
 *
 * Der Zeitraum-Slot ist auf die VERGANGENHEIT ausgelegt („letzten Monat");
 * hier zählt sein ENDE, weil eine Zielfrage nach vorn schaut. Liegt das Ende
 * nicht in der Zukunft, bleibt es beim Horizont statt bei einem negativen
 * Abstand — eine Anschaffung in der Vergangenheit gibt es nicht.
 */
function tageBis(slots: QuestionSlots, jetzt: Date, vorgabe: number): number {
  const bis = slots.zeitraum?.bis;
  if (!bis) return vorgabe;
  // `daten.jetzt` statt `Date.now()`: `antwort()` ist REIN — derselbe Aufruf
  // muss morgen dasselbe liefern, sonst wäre der Eintrag nicht testbar.
  const tage = Math.round((Date.parse(`${bis}T12:00:00Z`) - jetzt.getTime()) / 86_400_000);
  return tage > 0 ? tage : vorgabe;
}

/**
 * Tilgungsfragen (Welle 3) — gerechnet mit `calculatePayoffPlan`, derselben
 * Simulation, die `/debts` zeigt.
 *
 * **Das Budget ist die Mindestrate, nicht ein erfundener Betrag.** Wer fragt
 * „Wie lange zahle ich noch?", meint den Lauf, der ohne weitere Entscheidung
 * eintritt. Eine grosszügigere Annahme machte die Antwort schöner und
 * unbrauchbar; wer mehr zahlen kann, fragt danach ausdrücklich — dafür gibt
 * es `schulden.sondertilgung`.
 *
 * Sanfter Modus: Alle drei liefern rohe Zahlen, maskiert wird in der
 * Präsentation. Ein Schuldenstand ist genau die Zahl, für die
 * `docs/debt-avoidance-recovery.md` das Maskieren vorsieht.
 */
const KEINE_SCHULD: Omit<QuestionAnswer, 'aussage'> = {
  art: 'keine',
  wert: null,
  anzahl: 0,
  deepLink: '/debts',
  deepLinkArt: 'kontext',
};

/**
 * Trägt der Plan nicht?
 *
 * Zwei Fälle, und der zweite ist der gefährliche: `insufficientBudget` meldet
 * ein Budget UNTER der Summe der Mindestraten — hier rechnen wir aber mit
 * genau dieser Summe, das kann also nie eintreten. Was eintritt, ist die
 * Abbruchgrenze der Simulation: Decken die Raten die Zinsen nicht, läuft die
 * Schleife bis {@link MAX_TILGUNGS_MONATE} und liefert Zahlen ohne
 * Aussagekraft (gemessen: 600 Monate, 399.575.500 € Zinsen). Ohne diese
 * Prüfung antwortete der Chat „in 50 Jahren bist du fertig".
 */
function traegtNicht(plan: { insufficientBudget: boolean; totalMonths: number }): boolean {
  return plan.insufficientBudget || plan.totalMonths >= MAX_TILGUNGS_MONATE;
}

/** Der Plan, der ohne weitere Entscheidung eintritt: Budget = Summe der Mindestraten. */
function planBeiMindestraten(daten: QuestionData) {
  const schulden = [...(daten.debts ?? [])].filter((d) => !d.is_paid_off && d.balance > 0);
  if (schulden.length === 0) return null;
  const budget = totalMinimumPayment(schulden);
  if (budget <= 0) return null;
  return { schulden, budget, plan: calculatePayoffPlan(schulden, budget, 'avalanche') };
}

const schuldenDauer: QuestionEntry = {
  id: 'schulden.dauer',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.schuldenDauer'],
  verstaerker: ['financeQuestions.trigger.schulden'],
  needs: ['debts'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const stand = planBeiMindestraten(daten);
    if (!stand) {
      return { ...KEINE_SCHULD, aussage: { key: 'financeQuestions.answer.schuldenKeine', params: {} } };
    }
    if (traegtNicht(stand.plan)) {
      // Ehrlicher als eine Zahl: Decken die Raten die Zinsen nicht, gibt es
      // keine Laufzeit — die Schuld wächst.
      return {
        ...KEINE_SCHULD,
        aussage: { key: 'financeQuestions.answer.schuldenBudgetReichtNicht', params: {} },
      };
    }
    return {
      art: 'anzahl',
      wert: stand.plan.totalMonths,
      anzahl: stand.schulden.length,
      aussage: { key: 'financeQuestions.answer.schuldenDauer', params: {} },
      begruendung: [
        { key: 'financeQuestions.reason.schuldenBudget', params: { betrag: stand.budget } },
        { key: 'financeQuestions.reason.schuldenZinsenGesamt', params: { betrag: stand.plan.totalInterestPaid } },
      ],
      deepLink: '/debts',
      deepLinkArt: 'kontext',
    };
  },
};

const schuldenZinsen: QuestionEntry = {
  id: 'schulden.zinsen',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.schuldenZinsen'],
  verstaerker: ['financeQuestions.trigger.schulden'],
  needs: ['debts'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const stand = planBeiMindestraten(daten);
    if (!stand) {
      return { ...KEINE_SCHULD, aussage: { key: 'financeQuestions.answer.schuldenKeine', params: {} } };
    }
    if (traegtNicht(stand.plan)) {
      return {
        ...KEINE_SCHULD,
        aussage: { key: 'financeQuestions.answer.schuldenBudgetReichtNicht', params: {} },
      };
    }
    return {
      art: 'geld',
      wert: stand.plan.totalInterestPaid,
      anzahl: stand.schulden.length,
      aussage: { key: 'financeQuestions.answer.schuldenZinsen', params: {} },
      begruendung: [
        { key: 'financeQuestions.reason.schuldenLaufzeit', params: { monate: stand.plan.totalMonths } },
      ],
      deepLink: '/debts',
      deepLinkArt: 'kontext',
    };
  },
};

/**
 * „Was bringt es, wenn ich monatlich X mehr zahle?"
 *
 * Der Vergleich zweier Läufe derselben Simulation — deshalb `art: 'vergleich'`
 * und nicht zwei Zahlen nebeneinander: Es IST die Rechnung, für die diese
 * Antwortart in Welle 1 entstanden ist.
 *
 * Verglichen werden die ZINSEN, nicht die Monate: Die gesparten Zinsen sind
 * das Geld, das jemand behält. Die kürzere Laufzeit steht als Begründung
 * daneben, weil sie die Frage „wie lange noch" mitbeantwortet.
 */
const schuldenSondertilgung: QuestionEntry = {
  id: 'schulden.sondertilgung',
  slots: { erforderlich: ['betrag'], optional: [] },
  ausloeser: ['financeQuestions.trigger.sondertilgung'],
  verstaerker: ['financeQuestions.trigger.schulden'],
  needs: ['debts'],
  aufwand: 'guenstig',
  // „Was bringt es, WENN ich mehr zahle?" ist eine hypothetische Frage — das
  // Szenario-Gate hätte sie sonst abgewiesen, und der Chat hätte auf eine
  // beantwortbare Frage geschwiegen.
  //
  // Damit ist die Regel am Gate präziser zu fassen als bisher: Der Kommentar
  // an `leistbarkeit.anschaffung` sagt „die Simulation ist die EINZIGE
  // Funktion, die veränderte Welten rechnet". Das stimmt so nicht mehr —
  // `calculatePayoffPlan` mit einem anderen Budget rechnet ebenfalls eine
  // veränderte Welt, nur deterministisch statt stochastisch. Das Gate schützt
  // nicht die Simulation, sondern davor, dass eine BESTANDSAUSWERTUNG eine
  // Frage über eine andere Welt mit Ist-Zahlen beantwortet.
  beantwortetSzenarien: true,
  antwort: (slots, daten): QuestionAnswer => {
    const stand = planBeiMindestraten(daten);
    if (!stand || slots.betrag === undefined) {
      return { ...KEINE_SCHULD, aussage: { key: 'financeQuestions.answer.schuldenKeine', params: {} } };
    }
    if (traegtNicht(stand.plan)) {
      return {
        ...KEINE_SCHULD,
        aussage: { key: 'financeQuestions.answer.schuldenBudgetReichtNicht', params: {} },
      };
    }

    const mitExtra = calculatePayoffPlan(stand.schulden, stand.budget + slots.betrag, 'avalanche');
    const gespart = stand.plan.totalInterestPaid - mitExtra.totalInterestPaid;
    const monateKuerzer = stand.plan.totalMonths - mitExtra.totalMonths;

    return {
      art: 'vergleich',
      wert: mitExtra.totalInterestPaid,
      anzahl: stand.schulden.length,
      vergleich: {
        labelWert: '',
        labelReferenz: '',
        referenz: stand.plan.totalInterestPaid,
        differenz: -gespart,
        quote:
          stand.plan.totalInterestPaid > 0
            ? -gespart / stand.plan.totalInterestPaid
            : null,
      },
      aussage: {
        key: 'financeQuestions.answer.schuldenSondertilgung',
        params: { betrag: slots.betrag, gespart },
      },
      begruendung: [
        { key: 'financeQuestions.reason.schuldenKuerzer', params: { monate: monateKuerzer } },
      ],
      deepLink: '/debts',
      deepLinkArt: 'kontext',
    };
  },
};

export const questions: readonly QuestionEntry[] = [
  schuldenRestschuld,
  leistbarkeitAnschaffung,
  ratenOffen,
  zielObergrenze,
  zielSparrate,
  schuldenDauer,
  schuldenZinsen,
  schuldenSondertilgung,
];
