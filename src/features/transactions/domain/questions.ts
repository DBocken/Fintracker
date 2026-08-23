/**
 * Registereinträge der Buchungen-Slice (WP-C).
 *
 * Jeder Eintrag ist **Verdrahtung, keine Fachlogik**: Er ruft die reinen
 * Funktionen, die die Fläche ohnehin benutzt (`filterTransactions`,
 * `sumExpenses`/`sumIncome`), und baut daraus Wert plus Deep-Link. Müsste ein
 * Eintrag selbst rechnen, läge die reine Funktion am falschen Ort.
 *
 * Die tragende Invariante: **Die Menge, aus der `wert` entstand, ist exakt die
 * Menge, die `deepLink` zeigt.** Ein generischer Test über den ganzen Katalog
 * sichert sie ab (`src/lib/__tests__/question-registry.test.ts`) — ohne sie
 * driften genannte Zahl und verlinkte Liste auseinander, und der Chat würde
 * zur Quelle falscher Auskunft mit belastbar wirkendem Beleg.
 */
import type {
  QuestionAnswer,
  QuestionData,
  QuestionEntry,
  QuestionSlots,
  SlotName,
} from '@/lib/question-registry';
import type { DashboardFilterState } from '@/features/shared/domain/dashboard-filters';
import { filterTransactions, buildTransactionsHref } from '@/features/shared/domain/dashboard-filtering';
import { sumExpenses, sumIncome } from '@/lib/analysis-data';

/**
 * Übersetzt die Slots in genau den Filterzustand, mit dem gerechnet UND
 * verlinkt wird. Eine Quelle für beides — das ist der ganze Trick hinter der
 * Invariante.
 *
 * `erlaubt` ist nicht Zierde: Ein Eintrag darf NUR die Slots auswerten, die er
 * deklariert hat. Sonst filterte `ausgaben.haendler` zusätzlich nach einer
 * Kategorie, die ihm jemand mitgegeben hat, ohne dass die Frage danach
 * gefragt hätte — und die genannte Zahl wäre stillschweigend eine andere als
 * die erwartete.
 */
function filterAusSlots(
  slots: QuestionSlots,
  erlaubt: ReadonlySet<SlotName>,
): Partial<DashboardFilterState> {
  const filters: Partial<DashboardFilterState> = {};
  if (erlaubt.has('haendler') && slots.haendler) filters.merchant = slots.haendler;
  if (erlaubt.has('kategorie') && slots.kategorieId) filters.category = slots.kategorieId;
  if (erlaubt.has('konto') && slots.kontoId) filters.account = slots.kontoId;
  if (erlaubt.has('zeitraum') && slots.zeitraum) {
    const token = slots.zeitraum.rangeToken;
    if (/^\d{4}(-Q[1-4]|-\d{2})?$/.test(token)) {
      // Konkrete Periode: `range` trägt sie direkt (2026-Q2, 2026-07, 2026).
      filters.range = token.length === 4 ? 'Jahr' : token.includes('Q') ? 'Quartal' : 'Monat';
      filters.customPeriod = token;
    } else {
      // Rollende Spannen. Ohne diese Zuordnung fiele „letzte 30 Tage" still
      // auf „Gesamt" zurück — die Antwort nennte dann eine Summe über den
      // ganzen Bestand, obwohl nach einem Monat gefragt war.
      const spannen: Record<string, { range: DashboardFilterState['range']; tage?: number }> = {
        '7d': { range: '7 Tage', tage: 7 },
        '30d': { range: '30 Tage', tage: 30 },
        '90d': { range: '90 Tage', tage: 90 },
        all: { range: 'Gesamt' },
      };
      const spanne = spannen[token];
      if (spanne) {
        filters.range = spanne.range;
        if (spanne.tage) filters.customDays = spanne.tage;
      }
    }
  }
  return filters;
}

/** Vollständiger Zustand fürs Rechnen — `buildTransactionsHref` spreizt denselben. */
function vollstaendig(partial: Partial<DashboardFilterState>): DashboardFilterState {
  return {
    category: 'all',
    account: 'all',
    contract: 'all',
    essential: 'all',
    ausgabenklasse: 'all',
    search: '',
    merchant: '',
    range: 'Gesamt',
    customDays: 30,
    customPeriod: '',
    ...partial,
  };
}

/** Alle Slots, die ein Eintrag überhaupt auswerten darf. */
function erlaubteSlots(entry: Pick<QuestionEntry, 'slots'>): ReadonlySet<SlotName> {
  return new Set([...entry.slots.erforderlich, ...entry.slots.optional]);
}

function summenAntwort(
  entry: Pick<QuestionEntry, 'slots'>,
  slots: QuestionSlots,
  daten: QuestionData,
  richtung: 'ausgaben' | 'einnahmen',
  aussageKey: string,
): QuestionAnswer {
  const teilFilter = filterAusSlots(slots, erlaubteSlots(entry));
  const gefiltert = filterTransactions(
    [...(daten.transactions ?? [])],
    [...(daten.categories ?? [])],
    [...(daten.accounts ?? [])],
    vollstaendig(teilFilter),
    daten.jetzt,
  );

  const wert = richtung === 'ausgaben' ? sumExpenses(gefiltert) : sumIncome(gefiltert);

  return {
    art: 'geld',
    wert,
    anzahl: gefiltert.length,
    aussage: {
      key: aussageKey,
      params: {
        haendler: slots.haendler ?? '',
        // Ohne Zeitraum-Slot ist die Antwort der Gesamtbestand — das gehört
        // gesagt, nicht als leere Stelle im Satz verschluckt.
        zeitraum: slots.zeitraum?.label ?? '',
      },
    },
    deepLink: buildTransactionsHref(teilFilter),
    // Gerechnet wurde mit GENAU diesem Filter — Zahl und Link können nicht
    // auseinanderlaufen, weil beide aus `teilFilter` entstehen.
    deepLinkArt: 'quelle',
  };
}

const ausgabenHaendler: QuestionEntry = {
  id: 'ausgaben.haendler',
  slots: { erforderlich: ['haendler'], optional: ['zeitraum', 'konto'] },
  // Die Präposition „bei" war hier bewusst Auslöser und ist es NICHT mehr:
  // Ein Funktionswort trägt keine Absicht (Router-Ratsche, F.2). Händler
  // gegen Kategorie unterscheidet jetzt der SLOT — ein wörtlich getroffener
  // Händlername wiegt 2 Punkte, und ohne jeden Slot ist die Frage ehrlich
  // mehrdeutig und wird zur Kandidaten-Auswahl.
  ausloeser: ['financeQuestions.trigger.ausgaben'],
  needs: ['transactions', 'categories', 'accounts'],
  aufwand: 'guenstig',
  antwort(slots, daten) {
    return summenAntwort(this, slots, daten, 'ausgaben', 'financeQuestions.answer.ausgabenHaendler');
  },
};

const ausgabenKategorie: QuestionEntry = {
  id: 'ausgaben.kategorie',
  slots: { erforderlich: ['kategorie'], optional: ['zeitraum', 'konto'] },
  ausloeser: ['financeQuestions.trigger.ausgaben'],
  needs: ['transactions', 'categories', 'accounts'],
  aufwand: 'guenstig',
  antwort(slots, daten) {
    return summenAntwort(this, slots, daten, 'ausgaben', 'financeQuestions.answer.ausgabenKategorie');
  },
};

const einnahmenZeitraum: QuestionEntry = {
  id: 'einnahmen.zeitraum',
  slots: { erforderlich: [], optional: ['zeitraum', 'konto', 'kategorie'] },
  ausloeser: ['financeQuestions.trigger.einnahmen'],
  needs: ['transactions', 'categories', 'accounts'],
  aufwand: 'guenstig',
  antwort(slots, daten) {
    return summenAntwort(this, slots, daten, 'einnahmen', 'financeQuestions.answer.einnahmen');
  },
};

export const questions: readonly QuestionEntry[] = [
  ausgabenHaendler,
  ausgabenKategorie,
  einnahmenZeitraum,
];
