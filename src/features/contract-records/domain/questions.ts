/**
 * Registereintrag der Verträge-Slice (WP-C).
 *
 * Rechnet nichts Neues: `computeContracts` leitet die Vertragszeilen ohnehin
 * ab, `yearlyEquivalent` macht aus Betrag und Zyklus die Jahressumme. Der
 * Eintrag verbindet beides und findet die Zeile über die Händlerfamilie.
 */
import type { QuestionEntry } from '@/lib/question-registry';
import { computeContracts, yearlyEquivalent, monthlyEquivalent } from '@/lib/contract-derivation';
import { buildTransactionsHref } from '@/features/shared/domain/dashboard-filtering';
import { normalizeMerchantName } from '@/lib/merchant-normalization';

const vertragJahreskosten: QuestionEntry = {
  id: 'vertrag.jahreskosten',
  slots: { erforderlich: ['haendler'], optional: [] },
  ausloeser: ['financeQuestions.trigger.vertrag', 'financeQuestions.trigger.kostetImJahr'],
  needs: ['transactions', 'categories', 'contractDecisions'],
  aufwand: 'guenstig',
  antwort: (slots, daten) => {
    const gesucht = normalizeMerchantName(slots.haendler) || (slots.haendler ?? '').toLowerCase().trim();
    const categoryMap = new Map((daten.categories ?? []).map((c) => [c.id, c]));
    const zeilen = computeContracts(
      [...(daten.transactions ?? [])],
      categoryMap,
      'Ausgabe',
      {
        decisions: new Map(daten.contractDecisions ?? []),
        now: daten.jetzt,
      },
    );

    const treffer = zeilen.find((zeile) => {
      const name = normalizeMerchantName(zeile.payee) || zeile.payee.toLowerCase().trim();
      return name.includes(gesucht);
    });

    // Deep-Link auf `/transactions`, NICHT auf `/contracts`: Die Fläche hat
    // heute keine URL-Parameter (nachgeprüft: kein `useSearchParams` in
    // `ContractsPage.tsx`), ein Link dorthin zeigte also die ganze Liste statt
    // der Menge, aus der die Zahl stammt. Ein `?fp=`-Parameter für
    // `/contracts` ist ein sauberes Folgepaket — bis dahin ist das hier die
    // benannte Grenze, kein stiller Notbehelf.
    const deepLink = buildTransactionsHref({ merchant: gesucht });

    if (!treffer) {
      return {
        art: 'keine',
        wert: null,
        anzahl: 0,
        aussage: {
          key: 'financeQuestions.answer.vertragUnbekannt',
          params: { haendler: slots.haendler ?? '' },
        },
        deepLink,
        deepLinkArt: 'kontext',
      };
    }

    const betrag = treffer.amountRecentTypical ?? treffer.amountTypical;

    return {
      art: 'geld',
      wert: yearlyEquivalent(betrag, treffer.cycle),
      anzahl: treffer.transactionIds.length,
      aussage: {
        key: 'financeQuestions.answer.vertragJahreskosten',
        params: { haendler: treffer.payee },
      },
      begruendung: [
        {
          key: 'financeQuestions.reason.vertragRhythmus',
          params: { monatlich: monthlyEquivalent(betrag, treffer.cycle) },
        },
      ],
      deepLink,
      deepLinkArt: 'kontext',
    };
  },
};

export const questions: readonly QuestionEntry[] = [vertragJahreskosten];
