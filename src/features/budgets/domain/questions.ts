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
import type {
  QuestionAnswer,
  QuestionData,
  QuestionEntry,
  QuestionSlots,
} from '@/features/shared/domain/question-registry';
import { computeBudgetStatus } from '@/lib/budget-logic';
import type { Budget } from '@/lib/budget-types';

function monatsschluessel(jetzt: Date): string {
  return format(jetzt, 'yyyy-MM');
}

/**
 * Die Budgets, die zu den gefragten Kategorien gehören — über die
 * HAUPTKATEGORIE, nicht über die rohe ID.
 *
 * Nutzerfund (28.08.): „Welches budget für wohnung?" wurde richtig
 * verstanden und antwortete trotzdem „kein Budget angelegt", während auf
 * der Budget-Seite ein gefüllter Tank stand. Die Ursache ist eine
 * Asymmetrie aus zwei je für sich richtigen Entscheidungen:
 * `suggestBudgets` hängt jedes Budget an `cat.parent_id ?? cat.id`, also
 * immer an eine Hauptkategorie — und die Stichwort-Kaskade der Frage löst
 * laut eigener Dokumentation ausschliesslich auf der Unterkategorie-Ebene
 * auf. Der Vergleich roher IDs konnte deshalb strukturell nie treffen.
 *
 * Gemappt wird die FRAGE auf die Hauptkategorie, nicht das Budget nach
 * unten aufgelöst: Ein Budget kennt über `subcategory_ids` bereits seine
 * eigene Teilmenge, und die wertet `computeBudgetStatus` aus. Wer nach
 * einer Unterkategorie fragt, meint den Tank, in den sie fliesst.
 *
 * Ohne Kategorienliste bleibt es beim rohen Vergleich — dann ist die
 * Hauptkategorie schlicht nicht bestimmbar, und Raten wäre schlechter als
 * die alte Auskunft.
 */
function passendeBudgets(
  slots: QuestionSlots,
  daten: QuestionData,
): Budget[] {
  const budgets = [...(daten.budgets ?? [])];
  const gefragt = slots.kategorieIds;
  if (!gefragt?.length) return budgets;

  const nachId = new Map((daten.categories ?? []).map((c) => [c.id, c]));
  const hauptId = (id: string): string => nachId.get(id)?.parent_id ?? id;
  const gesucht = new Set(gefragt.map(hauptId));

  return budgets.filter((b) => b.category_id != null && gesucht.has(hauptId(b.category_id)));
}

const budgetStatus: QuestionEntry = {
  id: 'budget.status',
  slots: { erforderlich: [], optional: ['kategorie'] },
  ausloeser: ['financeQuestions.trigger.budget'],
  needs: ['budgets', 'transactions', 'categories', 'allocations'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const passend = passendeBudgets(slots, daten);

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
  const passend = passendeBudgets(slots, daten);
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

/**
 * Der erste SCHREIBENDE Eintrag (WP-I) — und er schreibt trotzdem nicht.
 *
 * `antwort()` bleibt rein: Sie sucht das bestehende Budget zur erkannten
 * Kategorie, rechnet Vorher/Nachher und liefert die VORSCHAU. Ausgeführt
 * wird erst per Bestätigen-Klick in der Fläche
 * (`use-budget-action.ts`) — der Chat schreibt nie aus eigener Deutung.
 *
 * `kategorie` ist Pflicht-Slot: Ohne aufgelöste Kategorie greift die übliche
 * Slot-Rückfrage mit den eigenen Kategorien als Vorschläge. Eine Aktion auf
 * „irgendein Budget" gibt es nicht.
 */
const budgetAktion: QuestionEntry = {
  id: 'budget.aktion',
  slots: { erforderlich: ['kategorie'], optional: ['betrag'] },
  ausloeser: ['financeQuestions.trigger.budgetAktion'],
  needs: ['budgets', 'categories'],
  aufwand: 'guenstig',
  nimmtBudgetAktion: true,
  antwort: (slots, daten): QuestionAnswer => {
    const absicht = slots.budgetAktion;
    const kategorieId = slots.kategorieIds?.[0];
    const kategorie = (daten.categories ?? []).find((k) => k.id === kategorieId);

    if (!absicht || !kategorieId) {
      return { ...KEIN_BUDGET, aussage: { key: 'financeQuestions.answer.budgetKeines', params: {} } };
    }

    const bestehend = (daten.budgets ?? []).find((b) => b.category_id === kategorieId);
    const name = bestehend?.name ?? kategorie?.name ?? '';

    // Ändern oder Löschen ohne bestehendes Budget: Das wird BENANNT, und die
    // Anlage als Vorschlag angeboten — stillschweigend nichts zu tun wäre
    // die schlechtere Auskunft.
    if (absicht.art !== 'anlegen' && !bestehend) {
      if (absicht.art === 'loeschen') {
        return {
          ...KEIN_BUDGET,
          aussage: { key: 'financeQuestions.answer.budgetAktionKeinBudget', params: { name } },
        };
      }
      return {
        art: 'aktion',
        wert: absicht.betrag,
        anzahl: 0,
        aussage: { key: 'financeQuestions.answer.budgetAktionStattdessenAnlegen', params: { name } },
        aktion: { art: 'anlegen', kategorieId, name, nachher: absicht.betrag },
        deepLink: '/budgets',
        deepLinkArt: 'kontext',
      };
    }

    if (absicht.art === 'loeschen') {
      return {
        art: 'aktion',
        wert: bestehend!.limit,
        anzahl: 1,
        aussage: { key: 'financeQuestions.answer.budgetAktionLoeschen', params: { name } },
        aktion: { art: 'loeschen', kategorieId, name, vorher: bestehend!.limit, budgetId: bestehend!.id },
        deepLink: '/budgets',
        deepLinkArt: 'kontext',
      };
    }

    if (absicht.art === 'anlegen') {
      // Existiert schon eins, ist „anlegen" in Wahrheit eine Änderung — sonst
      // entstünde ein zweiter Tank für dieselbe Kategorie.
      const nachher = absicht.betrag;
      return {
        art: 'aktion',
        wert: nachher,
        anzahl: bestehend ? 1 : 0,
        aussage: {
          key: bestehend
            ? 'financeQuestions.answer.budgetAktionAendern'
            : 'financeQuestions.answer.budgetAktionAnlegen',
          params: { name },
        },
        aktion: bestehend
          ? { art: 'aendern', kategorieId, name, vorher: bestehend.limit, nachher, budgetId: bestehend.id }
          : { art: 'anlegen', kategorieId, name, nachher },
        deepLink: '/budgets',
        deepLinkArt: 'kontext',
      };
    }

    const vorher = bestehend!.limit;
    const nachher =
      absicht.modus === 'auf'
        ? absicht.betrag
        : Math.max(0, vorher + (absicht.richtung === 'weniger' ? -absicht.betrag : absicht.betrag));

    return {
      art: 'aktion',
      wert: nachher,
      anzahl: 1,
      aussage: { key: 'financeQuestions.answer.budgetAktionAendern', params: { name } },
      aktion: { art: 'aendern', kategorieId, name, vorher, nachher, budgetId: bestehend!.id },
      deepLink: '/budgets',
      deepLinkArt: 'kontext',
    };
  },
};

export const questions: readonly QuestionEntry[] = [
  budgetStatus,
  budgetRest,
  budgetTagesrate,
  budgetAktion,
];
