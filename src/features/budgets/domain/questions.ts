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
    const passend = slots.kategorieId
      ? budgets.filter((b) => b.category_id === slots.kategorieId)
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

export const questions: readonly QuestionEntry[] = [budgetStatus];
