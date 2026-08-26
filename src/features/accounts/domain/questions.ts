/**
 * Registereinträge der Konten-Slice (Welle 2).
 *
 * Alle drei Antworten gab es in der App schon — auf `/accounts` und
 * `/liquidity`. Was fehlte, war der Datenkanal: `DataNeed` kannte weder die
 * Vermögensaufstellung noch die Kontosalden, und ohne sie konnte ein Eintrag
 * sie nicht anfordern.
 *
 * **Der Saldo kommt aus der Aufstellung, nicht aus einer eigenen Summe.**
 * Ein Kontostand ist nicht „Startsaldo plus alle Buchungen" — er ist der
 * ANKER (Bank-Saldo oder Startsaldo mit Stichtag) plus die Buchungen NACH
 * diesem Tag. Genau daran ist die App schon einmal gescheitert: Es gab zwei
 * Implementierungen derselben Rechnung, beide addierten alles auf den
 * Startsaldo, und wer Historie nachimportierte, sah sie doppelt (Changelog
 * 2026.8.3). Eine dritte Kopie hier wäre der dritte Ort, an dem dieselbe
 * Rechnung falsch sein kann.
 */
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { QuestionAnswer, QuestionData, QuestionEntry } from '@/lib/question-registry';
import { computeContracts } from '@/lib/contract-derivation';
import { buildForecastAccounts, buildRecurringFlows } from '@/lib/forecast-flows';
import { computeDisposableUntilPayday } from '@/lib/disposable-budget';
import { detectSalarySeries } from '@/lib/salary-detection';
import { findTransferCandidates } from '@/lib/transfer-detection';
import { monatsDurchschnitt } from '@/lib/spending-metrics';

const ISO = 'yyyy-MM-dd';

/**
 * Antwort, wenn die Aufstellung zwar gelesen wurde, aber nichts hergibt.
 *
 * Bewusst NICHT „0 €": Wer noch kein Konto angelegt hat, hat keinen
 * Kontostand von null — er hat keinen. Die Unterscheidung ist dieselbe wie
 * beim Kanal, der nicht lesbar war.
 */
const KEIN_KONTO: Omit<QuestionAnswer, 'aussage'> = {
  art: 'keine',
  wert: null,
  anzahl: 0,
  deepLink: '/accounts',
  deepLinkArt: 'kontext',
};

const kontoSaldo: QuestionEntry = {
  id: 'konto.saldo',
  slots: { erforderlich: ['konto'], optional: [] },
  ausloeser: ['financeQuestions.trigger.saldoJetzt'],
  needs: ['accounts', 'netWorth'],
  aufwand: 'guenstig',
  antwort: (slots, daten): QuestionAnswer => {
    const konto = (daten.accounts ?? []).find((a) => a.id === slots.kontoId);
    const saldo = konto ? daten.netWorth?.accountBalances[konto.id] : undefined;
    if (!konto || saldo === undefined) {
      return { ...KEIN_KONTO, aussage: { key: 'financeQuestions.answer.kontoUnbekannt', params: {} } };
    }
    return {
      art: 'geld',
      wert: saldo,
      anzahl: 1,
      aussage: { key: 'financeQuestions.answer.kontoSaldo', params: { konto: konto.name } },
      deepLink: `/accounts?account=${encodeURIComponent(konto.id)}`,
      deepLinkArt: 'quelle',
    };
  },
};

const kontoGesamt: QuestionEntry = {
  id: 'konto.gesamt',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.geldGesamt'],
  verstaerker: ['financeQuestions.trigger.saldoJetzt'],
  needs: ['accounts', 'netWorth'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const aufstellung = daten.netWorth;
    const konten = daten.accounts ?? [];
    if (!aufstellung || konten.length === 0) {
      return { ...KEIN_KONTO, aussage: { key: 'financeQuestions.answer.kontoKeines', params: {} } };
    }
    return {
      art: 'geld',
      // `cash` ist die Summe der ANKER-Salden — dieselbe Zahl, die
      // `/accounts` zeigt, nicht eine zweite Rechnung daneben.
      wert: aufstellung.cash,
      anzahl: konten.length,
      aussage: { key: 'financeQuestions.answer.kontoGesamt', params: { anzahl: konten.length } },
      deepLink: '/accounts',
      deepLinkArt: 'quelle',
    };
  },
};

/**
 * „Wie viel kann ich noch ausgeben?" — operatives Guthaben minus der bis zum
 * nächsten Geldeingang fälligen Abbuchungen.
 *
 * Die Frage ist ohne Gehaltstermin nicht beantwortbar, und das wird gesagt
 * statt geraten: „bis zum Monatsende" wäre eine stille Ersatzannahme, die für
 * jeden mit Gehalt am 15. die falsche Zahl liefert. Eine falsche Zahl ist
 * schlimmer als keine.
 */
const verfuegbarBisGehalt: QuestionEntry = {
  // Die ID ist die BESTEHENDE: Bis Welle 2 war das ein blosser Verweis auf
  // den Coach („rechnet der Coach live"). Ein zweiter Eintrag daneben hätte
  // dieselbe Frage doppelt beantwortbar gemacht und den Router in eine
  // Mehrdeutigkeit geschickt, die es fachlich nicht gibt. Stattdessen bekommt
  // der bestehende Eintrag seine Zahl — Korpus, Paraphrasen und Anzeigename
  // bleiben damit unverändert gültig.
  id: 'verfuegbar.bisGehalt',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.gehalt'],
  verstaerker: ['financeQuestions.trigger.bisGehalt'],
  needs: ['accounts', 'netWorth', 'transactions', 'categories', 'contractDecisions'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const aufstellung = daten.netWorth;
    const konten = daten.accounts ?? [];
    if (!aufstellung || konten.length === 0) {
      return { ...KEIN_KONTO, aussage: { key: 'financeQuestions.answer.kontoKeines', params: {} } };
    }

    const heuteIso = format(daten.jetzt, ISO);
    const naechsterEingang = naechsterGehaltsTag(daten, heuteIso);
    if (!naechsterEingang) {
      return {
        ...KEIN_KONTO,
        deepLink: '/liquidity',
        aussage: { key: 'financeQuestions.answer.freiVerfuegbarOhneGehalt', params: {} },
      };
    }

    const kategorien = new Map((daten.categories ?? []).map((c) => [c.id, c]));
    const vertraege = computeContracts([...(daten.transactions ?? [])], kategorien, 'Ausgabe', {
      decisions: new Map(daten.contractDecisions ?? []),
      now: daten.jetzt,
    });

    const tage = differenceInCalendarDays(parseISO(naechsterEingang), parseISO(heuteIso));
    const stand = computeDisposableUntilPayday({
      accounts: buildForecastAccounts([...konten], aufstellung.accountBalances),
      recurringFlows: buildRecurringFlows(vertraege),
      fromISO: heuteIso,
      paydayISO: naechsterEingang,
      daysUntilPayday: tage,
    });

    return {
      art: 'geld',
      wert: stand.disposable,
      anzahl: stand.obligationCount,
      aussage: {
        key:
          stand.disposable < 0
            ? 'financeQuestions.answer.freiVerfuegbarNegativ'
            : 'financeQuestions.answer.bisGehalt',
        params: { tage },
      },
      // Erklärbar statt behauptet: die beiden Summanden, aus denen die Zahl
      // entstand — dieselbe Idee wie `CategorizationResult.reasons`.
      begruendung: [
        { key: 'financeQuestions.reason.operativesGuthaben', params: { betrag: stand.operatingCash } },
        { key: 'financeQuestions.reason.faelligeAbbuchungen', params: { betrag: stand.obligations } },
      ],
      deepLink: '/liquidity',
      deepLinkArt: 'kontext',
    };
  },
};

/** Frühester erkannter Gehaltseingang ab heute; `null`, wenn keiner erkannt ist. */
function naechsterGehaltsTag(daten: QuestionData, heuteIso: string): string | null {
  const termine = detectSalarySeries([...(daten.transactions ?? [])], daten.jetzt)
    .map((s) => s.nextDateISO)
    .filter((iso) => iso >= heuteIso)
    .sort();
  return termine[0] ?? null;
}

/**
 * Nettovermögen: Bar + Depots + Forderungen − Schulden.
 *
 * Die Zahl wird aus der Aufstellung GENOMMEN, nicht hier gebildet — sonst
 * gäbe es zwei Definitionen von „Vermögen", und die zweite wäre die, die
 * niemand pflegt. Was NICHT drinsteckt, sagt der Eintrag dazu: Bestände in
 * fremder Währung fehlen bewusst (VE-1), und ein Vermögen, das seine Lücke
 * verschweigt, behauptet mehr, als es weiß.
 */
const vermoegenGesamt: QuestionEntry = {
  id: 'vermoegen.gesamt',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.vermoegen'],
  needs: ['netWorth'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const aufstellung = daten.netWorth;
    if (!aufstellung) {
      return { ...KEIN_KONTO, aussage: { key: 'financeQuestions.answer.vermoegenKeines', params: {} } };
    }
    const offen = aufstellung.unconvertedInvestments.length;
    return {
      art: 'geld',
      wert: aufstellung.netWorth,
      anzahl: aufstellung.accountSources.length + aufstellung.portfolioSources.length,
      aussage: { key: 'financeQuestions.answer.vermoegenGesamt', params: {} },
      begruendung: offen
        ? [{ key: 'financeQuestions.reason.fremdwaehrungNichtSummiert', params: { anzahl: offen } }]
        : [],
      deepLink: '/accounts',
      deepLinkArt: 'quelle',
    };
  },
};

/**
 * Woraus das Vermögen besteht — als Liste, weil eine einzelne Zahl die Frage
 * „woraus?" nicht beantwortet. Schulden erscheinen als NEGATIVE Zeile statt
 * als eigene Rubrik: Sie sind Teil derselben Rechnung, und sie wegzulassen
 * wäre die Beschönigung, gegen die der Sanfte Modus antritt
 * (`docs/debt-avoidance-recovery.md`).
 */
const vermoegenAufteilung: QuestionEntry = {
  id: 'vermoegen.aufteilung',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.vermoegenAufteilung'],
  verstaerker: ['financeQuestions.trigger.vermoegen'],
  needs: ['netWorth'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const aufstellung = daten.netWorth;
    if (!aufstellung) {
      return { ...KEIN_KONTO, aussage: { key: 'financeQuestions.answer.vermoegenKeines', params: {} } };
    }
    const posten = [
      { label: '', labelKey: 'financeQuestions.vermoegen.cash', betrag: aufstellung.cash },
      { label: '', labelKey: 'financeQuestions.vermoegen.investments', betrag: aufstellung.investments },
      { label: '', labelKey: 'financeQuestions.vermoegen.receivables', betrag: aufstellung.receivables },
      { label: '', labelKey: 'financeQuestions.vermoegen.debts', betrag: -aufstellung.debts },
    ].filter((p) => p.betrag !== 0);

    if (posten.length === 0) {
      return { ...KEIN_KONTO, aussage: { key: 'financeQuestions.answer.vermoegenKeines', params: {} } };
    }

    return {
      art: 'liste',
      wert: aufstellung.netWorth,
      anzahl: posten.length,
      // Die Rubriken sind Bildschirmtext, kein Nutzerdatum — deshalb
      // `labelKey` statt `label` (§6). Die Präsentation löst ihn auf.
      posten,
      aussage: { key: 'financeQuestions.answer.vermoegenAufteilung', params: {} },
      deepLink: '/accounts',
      deepLinkArt: 'quelle',
    };
  },
};

/**
 * „Habe ich Umbuchungen, die nicht als solche erkannt sind?"
 *
 * Ein unerkannter interner Übertrag ist der Fehler, der jede Auswertung
 * verzerrt und dabei völlig unauffällig aussieht: Die Abbuchung zählt als
 * Ausgabe, die Gutschrift als Einnahme, und beide Seiten stimmen für sich
 * genommen. Erst zusammen sind sie eine Verschiebung zwischen eigenen Konten
 * und gehören in keine der beiden Summen.
 *
 * Der Chat ZEIGT die Kandidaten und verlinkt sie; verknüpft wird auf der
 * Konten-Fläche mit einem Klick. Ein Übertrag, den der Chat aus eigener
 * Deutung markierte, veränderte jede Monatssumme rückwirkend — das ist eine
 * Schreiboperation und gehört hinter eine Bestätigung (Welle 5).
 */
const transferKandidaten: QuestionEntry = {
  id: 'transfer.kandidaten',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.transfer'],
  needs: ['transactions'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const kandidaten = findTransferCandidates([...(daten.transactions ?? [])]);
    if (kandidaten.length === 0) {
      return {
        art: 'anzahl',
        wert: 0,
        anzahl: 0,
        aussage: { key: 'financeQuestions.answer.transferKeine', params: {} },
        deepLink: '/accounts',
        deepLinkArt: 'kontext',
      };
    }
    return {
      art: 'liste',
      wert: null,
      anzahl: kandidaten.length,
      posten: kandidaten.slice(0, 10).map((k) => ({
        label: `${k.outgoing.payee || k.outgoing.description} → ${k.incoming.payee || k.incoming.description}`,
        betrag: Math.abs(k.outgoing.amount),
      })),
      aussage: { key: 'financeQuestions.answer.transferKandidaten', params: {} },
      begruendung: [{ key: 'financeQuestions.reason.transferNichtVerknuepft', params: {} }],
      deepLink: '/accounts',
      deepLinkArt: 'kontext',
    };
  },
};

/**
 * „Wie lange reicht mein Geld?" — operatives Guthaben geteilt durch die
 * durchschnittlichen Monatsausgaben.
 *
 * Bewusst OHNE Prognose: Das ist eine Division, keine Simulation. Wer wissen
 * will, wie sich der Kontostand mit allen Fälligkeiten entwickelt, bekommt
 * den Link auf die Liquiditätsfläche — hier steht die schlichte Reichweite,
 * und sie steht ehrlich als solche da.
 *
 * Das Sparkonto zählt NICHT mit: `netWorth.cash` enthält es, gefragt ist aber
 * das Geld, von dem gelebt wird. Ein Notgroschen, der die Reichweite
 * verlängert, verwischt genau die Zahl, wegen der jemand fragt.
 */
const liquiditaetReichweite: QuestionEntry = {
  id: 'liquiditaet.reichweite',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.reichweite'],
  needs: ['accounts', 'netWorth', 'transactions'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const aufstellung = daten.netWorth;
    const konten = daten.accounts ?? [];
    if (!aufstellung || konten.length === 0) {
      return { ...KEIN_KONTO, aussage: { key: 'financeQuestions.answer.kontoKeines', params: {} } };
    }

    const operativ = buildForecastAccounts([...konten], aufstellung.accountBalances)
      .filter((k) => k.kind === 'checking' || k.kind === 'cash' || k.kind === 'wallet')
      .reduce((summe, k) => summe + k.openingBalance, 0);

    const proMonat = monatsDurchschnitt([...(daten.transactions ?? [])]);
    if (proMonat === null || proMonat <= 0) {
      return {
        ...KEIN_KONTO,
        deepLink: '/liquidity',
        aussage: { key: 'financeQuestions.answer.reichweiteOhneAusgaben', params: {} },
      };
    }
    if (operativ <= 0) {
      return {
        ...KEIN_KONTO,
        deepLink: '/liquidity',
        aussage: { key: 'financeQuestions.answer.reichweiteOhneGuthaben', params: {} },
      };
    }

    const monate = operativ / proMonat;
    return {
      art: 'anzahl',
      wert: Math.round(monate * 10) / 10,
      anzahl: 0,
      aussage: { key: 'financeQuestions.answer.reichweite', params: {} },
      begruendung: [
        { key: 'financeQuestions.reason.reichweiteGuthaben', params: { betrag: operativ } },
        { key: 'financeQuestions.reason.reichweiteAusgaben', params: { betrag: proMonat } },
      ],
      deepLink: '/liquidity',
      deepLinkArt: 'kontext',
    };
  },
};

export const questions: readonly QuestionEntry[] = [
  kontoSaldo,
  kontoGesamt,
  verfuegbarBisGehalt,
  vermoegenGesamt,
  vermoegenAufteilung,
  transferKandidaten,
  liquiditaetReichweite,
];
