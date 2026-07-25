/**
 * Glossar der Fachbegriffe. Reine Domäne — kein React, kein I/O.
 *
 * Das Glossar besitzt seine eigenen Stichwörter (`glossary.terms.<id>.term`),
 * statt sie aus beliebigen UI-Keys abzuleiten. Ein Wörterbuch, dessen
 * Kopfwörter an einem Seitentitel hängen, bricht, sobald jemand den Titel
 * umformuliert („Nettovermögen" → „Dein Nettovermögen").
 *
 * Beide Register kommen trotzdem aus derselben Mechanik wie der übrige Text:
 * der Basiswert ist der Fachbegriff, der Overlay-Wert die Alltagsfassung.
 * Es gibt also keine zweite Wahrheit und keinen zweiten Pflegeort.
 */

export const GLOSSARY_TERM_IDS = [
  'liquidity',
  'netWorth',
  'savingsRate',
  'emergencyFund',
  'cashflow',
  'balance',
  'fixedCosts',
  'amortisation',
  'remainingDebt',
  'return',
  'liabilities',
  'reserve',
] as const;

export type GlossaryTermId = (typeof GLOSSARY_TERM_IDS)[number];

/** i18n-Key des Stichworts — Basis = Fachbegriff, Overlay = Alltagsfassung. */
export function glossaryTermKey(id: GlossaryTermId): string {
  return `glossary.terms.${id}.term`;
}

/** i18n-Key der Ein-Satz-Erklärung, ebenfalls registerabhängig. */
export function glossaryDefinitionKey(id: GlossaryTermId): string {
  return `glossary.terms.${id}.definition`;
}
