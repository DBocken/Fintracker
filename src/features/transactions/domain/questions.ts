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
} from '@/lib/question-registry';
import { filterTransactions, buildTransactionsHref } from '@/features/shared/domain/dashboard-filtering';
import { sumExpenses, sumIncome, topHaendler, topKategorien } from '@/lib/analysis-data';
import { computeIncomeContracts } from '@/lib/contract-derivation';
import { durchschnittlichesMonatsEinkommen, einkommensSchwankung } from '@/lib/income-stats';
import { findeAusreisser, type MonatsPunkt } from '@/features/shared/domain/unusual-expenses';
import { erlaubteSlots, filterAusSlots, vollstaendig } from './question-filters';
import { metricQuestions } from './metric-questions';

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

/** Buchungen im Zeitfenster der Slots — für Einträge ohne eigene Filterfrage. */
function gefilterteBuchungen(entry: Pick<QuestionEntry, 'slots'>, slots: QuestionSlots, daten: QuestionData) {
  return filterTransactions(
    [...(daten.transactions ?? [])],
    [...(daten.categories ?? [])],
    [...(daten.accounts ?? [])],
    vollstaendig(filterAusSlots(slots, erlaubteSlots(entry))),
    daten.jetzt,
  );
}

const ausgabenGesamt: QuestionEntry = {
  id: 'ausgaben.gesamt',
  slots: { erforderlich: [], optional: ['zeitraum', 'konto'] },
  ausloeser: ['financeQuestions.trigger.ausgaben'],
  verstaerker: ['financeQuestions.trigger.zusammen'],
  needs: ['transactions', 'categories', 'accounts'],
  aufwand: 'guenstig',
  antwort: (slots, daten) =>
    summenAntwort(ausgabenGesamt, slots, daten, 'ausgaben', 'financeQuestions.answer.ausgabenGesamt'),
};

/**
 * Top-N-Familien: Die Liste IST die Antwort. `label` ist Nutzerdatum
 * (Händler-/Kategoriename), die Gruppierung reine `lib`-Funktion.
 */
const ausgabenTopHaendler: QuestionEntry = {
  id: 'ausgaben.topHaendler',
  slots: { erforderlich: [], optional: ['zeitraum'] },
  ausloeser: ['financeQuestions.trigger.haendlerWort'],
  verstaerker: ['financeQuestions.trigger.amMeisten', 'financeQuestions.trigger.ausgaben'],
  needs: ['transactions', 'categories', 'accounts'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const top = topHaendler(gefilterteBuchungen(ausgabenTopHaendler, slots, daten), 10);
    if (top.length === 0) {
      return {
        art: 'keine', wert: null, anzahl: 0,
        aussage: { key: 'financeQuestions.answer.topLeer', params: {} },
        deepLink: buildTransactionsHref(filterAusSlots(slots, erlaubteSlots(ausgabenTopHaendler))),
        deepLinkArt: 'kontext',
      };
    }
    return {
      art: 'liste',
      wert: top.reduce((s, g) => s + g.summe, 0),
      anzahl: top.length,
      posten: top.map((g) => ({ label: g.label, betrag: g.summe })),
      aussage: {
        key: 'financeQuestions.answer.topHaendler',
        params: { anzahl: top.length, zeitraum: slots.zeitraum?.label ?? '' },
      },
      deepLink: buildTransactionsHref(filterAusSlots(slots, erlaubteSlots(ausgabenTopHaendler))),
      deepLinkArt: 'kontext',
    };
  },
};

const ausgabenTopKategorien: QuestionEntry = {
  id: 'ausgaben.topKategorien',
  slots: { erforderlich: [], optional: ['zeitraum'] },
  ausloeser: ['financeQuestions.trigger.wofuer'],
  verstaerker: ['financeQuestions.trigger.amMeisten', 'financeQuestions.trigger.ausgaben'],
  needs: ['transactions', 'categories', 'accounts'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const top = topKategorien(
      gefilterteBuchungen(ausgabenTopKategorien, slots, daten),
      [...(daten.categories ?? [])],
      5,
    );
    if (top.length === 0) {
      return {
        art: 'keine', wert: null, anzahl: 0,
        aussage: { key: 'financeQuestions.answer.topLeer', params: {} },
        deepLink: buildTransactionsHref(filterAusSlots(slots, erlaubteSlots(ausgabenTopKategorien))),
        deepLinkArt: 'kontext',
      };
    }
    return {
      art: 'liste',
      wert: top.reduce((s, g) => s + g.summe, 0),
      anzahl: top.length,
      posten: top.map((g) => ({ label: g.label, betrag: g.summe })),
      aussage: {
        key: 'financeQuestions.answer.topKategorien',
        params: { anzahl: top.length, zeitraum: slots.zeitraum?.label ?? '' },
      },
      deepLink: buildTransactionsHref(filterAusSlots(slots, erlaubteSlots(ausgabenTopKategorien))),
      deepLinkArt: 'kontext',
    };
  },
};

/**
 * Ungewöhnlich hohe Kategorie-Monate — dieselbe Statistik wie der
 * MCP-Snapshot (`features/shared/domain/unusual-expenses.ts`), nur mit
 * i18n-Keys statt fertiger Sätze.
 */
const ausgabenUngewoehnlich: QuestionEntry = {
  id: 'ausgaben.ungewoehnlich',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.ungewoehnlich'],
  // Welle 1: „Welcher MONAT war ungewöhnlich hoch?" fragt nach einem Monat,
  // nicht nach einer Summe — ohne diesen Verstärker gewann die
  // Kategorie-Summe (Auslöser + Kategorie-Slot schlugen den einzelnen
  // Ausreisser-Auslöser) und beantwortete die falsche Frage. Der Verstärker
  // hebt den Eintrag auf Augenhöhe; bleibt es knapp, fragt die Fläche nach,
  // statt zu raten.
  verstaerker: ['financeQuestions.trigger.monatWort'],
  needs: ['transactions', 'categories'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const nameById = new Map((daten.categories ?? []).map((c) => [c.id, c.name]));
    const serien = new Map<string, MonatsPunkt[]>();
    for (const t of daten.transactions ?? []) {
      if (t.is_transfer || t.amount >= 0 || !t.category_id) continue;
      const monat = t.date.slice(0, 7);
      const punkte = serien.get(t.category_id) ?? [];
      const punkt = punkte.find((p) => p.monat === monat);
      if (punkt) punkt.betrag += Math.abs(t.amount);
      else punkte.push({ monat, betrag: Math.abs(t.amount) });
      serien.set(t.category_id, punkte);
    }

    const funde = findeAusreisser(serien).slice(0, 5);
    if (funde.length === 0) {
      return {
        art: 'keine', wert: null, anzahl: 0,
        aussage: { key: 'financeQuestions.answer.ungewoehnlichKeine', params: {} },
        deepLink: '/transactions',
        deepLinkArt: 'kontext',
      };
    }
    return {
      art: 'liste',
      wert: null,
      anzahl: funde.length,
      posten: funde.map((f) => ({
        label: nameById.get(f.schluessel) ?? f.schluessel,
        betrag: f.betrag,
        monatIso: f.monat,
      })),
      aussage: { key: 'financeQuestions.answer.ungewoehnlich', params: { anzahl: funde.length } },
      begruendung: [{ key: 'financeQuestions.reason.ungewoehnlichDefinition', params: {} }],
      deepLink: '/transactions',
      deepLinkArt: 'kontext',
    };
  },
};

/** Jüngste Zeile der erkannten Gehalts-/Einnahmen-Serien — Basis von einkommen.letztes. */
function juengsteEinnahmeSerie(daten: QuestionData) {
  const categoryMap = new Map((daten.categories ?? []).map((c) => [c.id, c]));
  const zeilen = computeIncomeContracts([...(daten.transactions ?? [])], categoryMap, {
    now: daten.jetzt,
  });
  return zeilen.sort((a, b) => b.lastDateISO.localeCompare(a.lastDateISO))[0];
}

const einkommenLetztes: QuestionEntry = {
  id: 'einkommen.letztes',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.gehalt'],
  verstaerker: ['financeQuestions.trigger.letztes'],
  needs: ['transactions', 'categories'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const serie = juengsteEinnahmeSerie(daten);
    if (!serie) {
      return {
        art: 'keine', wert: null, anzahl: 0,
        aussage: { key: 'financeQuestions.answer.einkommenKeines', params: {} },
        deepLink: '/transactions', deepLinkArt: 'kontext',
      };
    }
    return {
      art: 'geld',
      wert: Math.abs(serie.amountLast),
      anzahl: serie.transactionIds.length,
      aussage: {
        key: 'financeQuestions.answer.einkommenLetztes',
        params: { haendler: serie.payee, datum: serie.lastDateISO },
      },
      deepLink: buildTransactionsHref({ merchant: serie.payee.toLowerCase() }),
      deepLinkArt: 'kontext',
    };
  },
};

const einkommenDurchschnitt: QuestionEntry = {
  id: 'einkommen.durchschnitt',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.gehalt'],
  verstaerker: ['financeQuestions.trigger.durchschnitt'],
  needs: ['transactions'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const schnitt = durchschnittlichesMonatsEinkommen([...(daten.transactions ?? [])], daten.jetzt, 6);
    if (schnitt === null) {
      return {
        art: 'keine', wert: null, anzahl: 0,
        aussage: { key: 'financeQuestions.answer.einkommenKeines', params: {} },
        deepLink: '/transactions', deepLinkArt: 'kontext',
      };
    }
    return {
      art: 'geld',
      wert: schnitt,
      anzahl: 6,
      aussage: { key: 'financeQuestions.answer.einkommenDurchschnitt', params: {} },
      // „Letzte 6 VOLLE Monate" gehört gesagt: Der laufende zählt nicht mit,
      // sonst sähe am Monatsdritten jedes Einkommen eingebrochen aus.
      begruendung: [{ key: 'financeQuestions.reason.einkommenDefinition', params: {} }],
      deepLink: '/transactions',
      deepLinkArt: 'kontext',
    };
  },
};

const einkommenSchwankungEintrag: QuestionEntry = {
  id: 'einkommen.schwankung',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.schwankt'],
  verstaerker: ['financeQuestions.trigger.gehalt'],
  needs: ['transactions'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const s = einkommensSchwankung([...(daten.transactions ?? [])], daten.jetzt, 6);
    if (!s) {
      return {
        art: 'keine', wert: null, anzahl: 0,
        aussage: { key: 'financeQuestions.answer.schwankungKeine', params: {} },
        deepLink: '/transactions', deepLinkArt: 'kontext',
      };
    }
    return {
      art: 'geld',
      wert: s.abweichung,
      anzahl: s.monate,
      aussage: { key: 'financeQuestions.answer.schwankung', params: { anzahl: s.monate } },
      begruendung: [
        { key: 'financeQuestions.reason.schwankungMittel', params: { monatlich: s.mittel } },
      ],
      deepLink: '/transactions',
      deepLinkArt: 'kontext',
    };
  },
};

export const questions: readonly QuestionEntry[] = [
  ausgabenHaendler,
  ausgabenKategorie,
  einnahmenZeitraum,

  ausgabenGesamt,
  ausgabenTopHaendler,
  ausgabenTopKategorien,
  ausgabenUngewoehnlich,
  einkommenLetztes,
  einkommenDurchschnitt,
  einkommenSchwankungEintrag,
  // Kennzahl- und Vergleichs-Einträge (Welle 1) — eigene Datei, damit diese
  // hier lesbar bleibt; der Katalog-Glob sieht nur diese Sammelstelle.
  ...metricQuestions,
];
