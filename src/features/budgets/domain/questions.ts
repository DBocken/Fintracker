/**
 * Registereintrag der Budget-Fläche (WP-C).
 *
 * Der Eintrag mit einer NICHT-Geld-Antwort (`art: 'quote'`) — er belegt, dass
 * die Bauform nicht nur Summen trägt. Gerechnet wird mit `computeBudgetStatus`
 * aus `@/lib/budget-logic`, also mit derselben reinen Funktion, die auch
 * `/budgets` benutzt.
 *
 * Der Monatsschlüssel wird hier gebildet und nicht aus
 * `services/budget-service.currentMonthKey` geholt: Eine Feature-`domain` darf
 * `src/services/` nicht importieren (`check:layers`, Regel
 * `feature-domain-rein`) — und für „Jahr-Bindestrich-Monat" ist das die
 * richtige Antwort, nicht der Umzug einer Service-Funktion.
 */
import { format } from 'date-fns';
import type { QuestionAnswer, QuestionEntry } from '@/lib/question-registry';
import { computeBudgetStatus } from '@/lib/budget-logic';

function monatsschluessel(jetzt: Date): string {
  return format(jetzt, 'yyyy-MM');
}

const budgetStatus: QuestionEntry = {
  id: 'budget.status',
  slots: { erforderlich: [], optional: ['kategorie'] },
  ausloeser: ['financeQuestions.trigger.budget'],
  needs: ['budgets', 'transactions', 'categories', 'allocations'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const budgets = [...(daten.budgets ?? [])];
    const passend = slots.kategorieIds?.length
      ? budgets.filter((b) => b.category_id != null && slots.kategorieIds!.includes(b.category_id))
      : budgets;

    if (!passend.length) {
      return {
        art: 'keine',
        wert: null,
        anzahl: 0,
        aussage: { key: 'financeQuestions.answer.budgetKeines', params: {} },
        deepLink: '/budgets',
        deepLinkArt: 'kontext',
      };
    }

    const monat = monatsschluessel(daten.jetzt);
    const allocations = daten.allocationsByTransaction
      ? new Map(daten.allocationsByTransaction)
      : undefined;
    const staende = passend.map((budget) =>
      computeBudgetStatus(
        budget,
        [...(daten.transactions ?? [])],
        [...(daten.categories ?? [])],
        monat,
        allocations,
      ),
    );

    const grenze = staende.reduce((summe, s) => summe + s.budget.limit, 0);
    const verbraucht = staende.reduce((summe, s) => summe + s.spent, 0);
    const ueberzogen = staende.filter((s) => s.health === 'over').length;

    return {
      art: 'quote',
      wert: grenze > 0 ? verbraucht / grenze : 0,
      anzahl: staende.length,
      aussage: {
        key: 'financeQuestions.answer.budgetStatus',
        params: { ueberzogen },
      },
      begruendung: [
        {
          key: 'financeQuestions.reason.budgetRest',
          params: { rest: grenze - verbraucht },
        },
      ],
      deepLink: '/budgets',
      deepLinkArt: 'kontext',
    };
  },
};

/** Stände aller (oder der passenden) Budgets im laufenden Monat. */
function budgetStaende(slots: Parameters<QuestionEntry['antwort']>[0], daten: Parameters<QuestionEntry['antwort']>[1]) {
  const budgets = [...(daten.budgets ?? [])];
  const passend = slots.kategorieIds?.length
    ? budgets.filter((b) => b.category_id != null && slots.kategorieIds!.includes(b.category_id))
    : budgets;
  const allocations = daten.allocationsByTransaction
    ? new Map(daten.allocationsByTransaction)
    : undefined;
  return passend.map((budget) =>
    computeBudgetStatus(
      budget,
      [...(daten.transactions ?? [])],
      [...(daten.categories ?? [])],
      monatsschluessel(daten.jetzt),
      allocations,
    ),
  );
}

const KEIN_BUDGET: Omit<QuestionAnswer, 'aussage'> & { art: 'keine'; wert: null } = {
  art: 'keine',
  wert: null,
  anzahl: 0,
  deepLink: '/budgets',
  deepLinkArt: 'kontext',
};

/**
 * „Wie viel kann ich noch für X ausgeben?" — der REST, nicht der Füllstand.
 * Dieselbe Rechnung wie `budget.status`, aber die Zahl, nach der gefragt
 * wurde: Limit minus Verbrauch, nie negativ verschwiegen.
 */
const budgetRest: QuestionEntry = {
  id: 'budget.rest',
  slots: { erforderlich: [], optional: ['kategorie'] },
  ausloeser: ['financeQuestions.trigger.uebrig'],
  verstaerker: ['financeQuestions.trigger.budget'],
  needs: ['budgets', 'transactions', 'categories', 'allocations'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const staende = budgetStaende(slots, daten);
    if (!staende.length) {
      return { ...KEIN_BUDGET, aussage: { key: 'financeQuestions.answer.budgetKeines', params: {} } };
    }

    const grenze = staende.reduce((summe, s) => summe + s.budget.limit, 0);
    const verbraucht = staende.reduce((summe, s) => summe + s.spent, 0);
    const rest = grenze - verbraucht;

    return {
      art: 'geld',
      wert: Math.max(0, rest),
      anzahl: staende.length,
      aussage: {
        key: rest < 0 ? 'financeQuestions.answer.budgetRestUeberzogen' : 'financeQuestions.answer.budgetRest',
        // Ein überzogenes Budget als „0 € übrig" zu verkaufen wäre die halbe
        // Wahrheit — der Fehlbetrag gehört gesagt.
        params: rest < 0 ? { betrag: Math.abs(rest) } : {},
      },
      deepLink: '/budgets',
      deepLinkArt: 'kontext',
    };
  },
};

/**
 * „Wie viel pro Tag, damit es bis Monatsende reicht?" — Rest geteilt durch
 * verbleibende Tage einschliesslich heute. Arithmetik, keine Prognose.
 */
const budgetTagesrate: QuestionEntry = {
  id: 'budget.tagesrate',
  slots: { erforderlich: [], optional: ['kategorie'] },
  ausloeser: ['financeQuestions.trigger.taeglich'],
  verstaerker: ['financeQuestions.trigger.budget', 'financeQuestions.trigger.reicht'],
  needs: ['budgets', 'transactions', 'categories', 'allocations'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const staende = budgetStaende(slots, daten);
    if (!staende.length) {
      return { ...KEIN_BUDGET, aussage: { key: 'financeQuestions.answer.budgetKeines', params: {} } };
    }

    const grenze = staende.reduce((summe, s) => summe + s.budget.limit, 0);
    const verbraucht = staende.reduce((summe, s) => summe + s.spent, 0);
    const rest = Math.max(0, grenze - verbraucht);

    const jahr = daten.jetzt.getUTCFullYear();
    const monat = daten.jetzt.getUTCMonth();
    const letzterTag = new Date(Date.UTC(jahr, monat + 1, 0)).getUTCDate();
    const verbleibend = Math.max(1, letzterTag - daten.jetzt.getUTCDate() + 1);

    return {
      art: 'geld',
      wert: rest / verbleibend,
      anzahl: staende.length,
      aussage: { key: 'financeQuestions.answer.budgetTagesrate', params: { anzahl: verbleibend } },
      begruendung: [
        { key: 'financeQuestions.reason.tagesrateBasis', params: { rest } },
      ],
      deepLink: '/budgets',
      deepLinkArt: 'kontext',
    };
  },
};

export const questions: readonly QuestionEntry[] = [budgetStatus, budgetRest, budgetTagesrate];
