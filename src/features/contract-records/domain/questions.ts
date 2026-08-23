/**
 * Registereintrag der Verträge-Slice (WP-C).
 *
 * Rechnet nichts Neues: `computeContracts` leitet die Vertragszeilen ohnehin
 * ab, `yearlyEquivalent` macht aus Betrag und Zyklus die Jahressumme. Der
 * Eintrag verbindet beides und findet die Zeile über die Händlerfamilie.
 */
import type { QuestionEntry } from '@/lib/question-registry';
import { computeContracts, yearlyEquivalent, monthlyEquivalent } from '@/lib/contract-derivation';
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

    // Deep-Link auf den VERTRAG selbst. Bis `/contracts` einen
    // `?merchant=`-Parameter bekam, musste hier ersatzweise die Buchungsliste
    // herhalten — also eine ANDERE Menge als die, aus der die Zahl stammt.
    // Jetzt öffnet der Link genau die Vertragszeile, die gerechnet wurde.
    //
    // Der normalisierte NAME und nicht der Fingerprint: `iban:de89…|out` wäre
    // eine IBAN in einer teilbaren URL.
    const deepLink = `/contracts?merchant=${encodeURIComponent(gesucht)}`;

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
        deepLinkLabelKey: 'financeQuestions.showContracts',
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
      // `kontext` und nicht `quelle`: Die Zahl ist die Jahresrechnung aus der
      // erkannten Serie, der Link zeigt die Vertragszeile. Das ist dieselbe
      // Sache, aber keine Buchungsmenge — die harte Invariante des Registers
      // prüft Buchungsmengen und liesse sich darauf nicht anwenden.
      deepLinkArt: 'kontext',
      deepLinkLabelKey: 'financeQuestions.showContract',
    };
  },
};

export const questions: readonly QuestionEntry[] = [vertragJahreskosten];
