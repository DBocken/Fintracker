/**
 * Registereinträge der Steuer-Slice (Welle 2).
 *
 * Gerechnet wird mit `buildEuerReport` und `computeTaxTank` — denselben reinen
 * Funktionen, die `/euer` und `/tax-report` benutzen. Beide brauchen nur
 * Buchungen, Konten und die gespeicherten Rücklage-Bewegungen; ein eigener
 * Datenkanal war deshalb nur für die Bewegungen nötig, nicht für die EÜR.
 *
 * **Beide Einträge sagen ab, wenn der Einzelunternehmer-Modus aus ist.** Ohne
 * ihn gibt es kein Geschäftskonto, und ohne Geschäftskonto ist jede
 * EÜR-Zahl null — nicht, weil nichts verdient wurde, sondern weil niemand
 * gesagt hat, welches Konto geschäftlich ist. „0 € Gewinn" wäre hier die
 * falscheste aller möglichen Antworten.
 *
 * Nicht beantwortet wird die Umsatzsteuer: Die EÜR ist bewusst
 * Kleinunternehmer (§ 19 UStG, dokumentiert in `lib/euer-report.ts`). Das ist
 * eine Produktentscheidung, keine Lücke des Chats.
 */
import type { QuestionAnswer, QuestionData, QuestionEntry } from '@/features/shared/domain/question-registry';
import { buildEuerReport } from '@/lib/euer-report';
import { computeTaxTank } from '@/lib/tax-reserve-tank';
import { resolveTaxReservePercent } from '@/lib/tax-reserve';

const KEINE_STEUER: Omit<QuestionAnswer, 'aussage'> = {
  art: 'keine',
  wert: null,
  anzahl: 0,
  deepLink: '/euer',
  deepLinkArt: 'kontext',
};

/** Absage, solange der Einzelunternehmer-Modus nicht eingeschaltet ist. */
function ohneUnternehmerModus(daten: QuestionData): QuestionAnswer | null {
  if (daten.settings?.business_mode) return null;
  return {
    ...KEINE_STEUER,
    aussage: { key: 'financeQuestions.answer.steuerOhneModus', params: {} },
    deepLink: '/settings',
  };
}

const steuerGewinn: QuestionEntry = {
  id: 'steuer.gewinn',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.steuerGewinn'],
  verstaerker: ['financeQuestions.trigger.steuer'],
  needs: ['transactions', 'accounts', 'settings'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const absage = ohneUnternehmerModus(daten);
    if (absage) return absage;

    const jahr = daten.jetzt.getFullYear();
    const bericht = buildEuerReport(
      [...(daten.transactions ?? [])],
      [...(daten.accounts ?? [])],
      jahr,
    );

    return {
      art: 'geld',
      wert: bericht.gewinn,
      anzahl: bericht.einnahmen.lines.length + bericht.ausgaben.lines.length,
      aussage: {
        key: bericht.gewinn < 0 ? 'financeQuestions.answer.steuerVerlust' : 'financeQuestions.answer.steuerGewinn',
        params: { jahr },
      },
      begruendung: [
        { key: 'financeQuestions.reason.euerEinnahmen', params: { betrag: bericht.einnahmen.total } },
        { key: 'financeQuestions.reason.euerAusgaben', params: { betrag: bericht.ausgaben.deductibleTotal } },
        // Die Steuerparameter eines laufenden Jahres stehen noch nicht fest;
        // wird mit denen eines Vorjahres gerechnet, gehört das gesagt.
        ...(bericht.paramsExact
          ? []
          : [{ key: 'financeQuestions.reason.euerParameterGeschaetzt', params: { jahr: bericht.paramsUsedYear } }]),
      ],
      deepLink: '/euer',
      deepLinkArt: 'kontext',
    };
  },
};

const steuerRuecklage: QuestionEntry = {
  id: 'steuer.ruecklage',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.steuerRuecklage'],
  verstaerker: ['financeQuestions.trigger.steuer'],
  needs: ['transactions', 'accounts', 'settings', 'taxReserve'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const absage = ohneUnternehmerModus(daten);
    if (absage) return absage;

    const jahr = daten.jetzt.getFullYear();
    const bericht = buildEuerReport(
      [...(daten.transactions ?? [])],
      [...(daten.accounts ?? [])],
      jahr,
    );
    // Ein Jahres-Override schlägt die allgemeine Einstellung — genau dafür
    // gibt es ihn.
    const prozent =
      daten.taxReserve?.percent_override ?? resolveTaxReservePercent(daten.settings);
    const tank = computeTaxTank(bericht.einnahmen.total, prozent, daten.taxReserve?.movements ?? []);

    if (tank.target <= 0) {
      return {
        ...KEINE_STEUER,
        aussage: { key: 'financeQuestions.answer.steuerOhneEinnahmen', params: { jahr } },
      };
    }

    // Gefragt ist „wie viel muss ich noch zurücklegen" — also die LÜCKE, nicht
    // das Ziel. Wer schon genug hat, bekommt das gesagt statt einer 0, die
    // wie ein Fehler aussieht.
    return {
      art: 'geld',
      wert: tank.gap,
      anzahl: (daten.taxReserve?.movements ?? []).length,
      aussage: {
        key: tank.gap > 0 ? 'financeQuestions.answer.steuerRuecklageLuecke' : 'financeQuestions.answer.steuerRuecklageVoll',
        params: { jahr },
      },
      begruendung: [
        { key: 'financeQuestions.reason.steuerZiel', params: { betrag: tank.target, prozent } },
        { key: 'financeQuestions.reason.steuerZurueckgelegt', params: { betrag: tank.saved } },
      ],
      deepLink: '/euer',
      deepLinkArt: 'kontext',
    };
  },
};

export const questions: readonly QuestionEntry[] = [steuerGewinn, steuerRuecklage];
