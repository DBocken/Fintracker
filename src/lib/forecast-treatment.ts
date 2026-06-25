/**
 * Forecast-Behandlung (Domänenregel) – die einzige Quelle der Wahrheit dafür,
 * WIE eine Transaktion in der Liquiditätsprognose behandelt wird.
 *
 * Hintergrund: `ausgabenklasse` (essenziell/diskretionaer/sparen/einkommen)
 * beschreibt die *wirtschaftliche Art* einer Ausgabe – für Analyse, Sankey,
 * Reporting. Die Prognose braucht aber eine andere Frage:
 *   „Ist das ein wiederkehrender, variabler Konsumblock, der nicht bereits als
 *    Vertrag/Fixkosten/Recurring-Flow prognostiziert wird?“
 * Diese Funktion leitet die Antwort aus den verlässlichsten vorhandenen
 * Signalen ab – ohne neues persistiertes Feld und ohne zweite Wahrheitsquelle
 * neben der Vertragserkennung.
 *
 * Wichtig: `essenziell` bedeutet NICHT automatisch variabel. Miete ist
 * essenziell, aber als Vertrag (`is_contract`) ein Fixkostenposten. Deshalb
 * schlagen die Transaktions-Flags die Kategorie.
 */
import { resolveAusgabenklasse } from '@/lib/analysis-data';
import { merchantFingerprint } from '@/lib/merchant-fingerprint';
import type { Category, Transaction } from '@/types';

export type ForecastTreatment =
  | 'income'
  | 'fixed_recurring'
  | 'variable_consumption'
  | 'saving_investment'
  | 'transfer'
  | 'uncategorized';

export interface ForecastTreatmentContext {
  /** Kategorien per ID, um die (ggf. vererbte) Ausgabenklasse aufzulösen. */
  categoriesById: Map<string, Category>;
  /**
   * Fingerprints beendeter/pausierter/archivierter Vertragsfamilien. Solche
   * Buchungen sind keine zukünftigen variablen Ausgaben (sie liefen als
   * Vertrag) und werden wie Fixkosten behandelt.
   */
  excludedFingerprints?: ReadonlySet<string>;
}

/**
 * Klassifiziert eine Transaktion nach ihrer Prognose-Behandlung. Nur
 * `variable_consumption` speist die variable Ausgaben-Baseline.
 *
 * Präzedenz – verlässlichstes Signal zuerst:
 *  1. interner Transfer        → transfer
 *  2. Vertrag / beendeter Vertrag → fixed_recurring  (schlägt die Kategorie)
 *  3. Einkommens-Kategorie     → income  (schlägt das Vorzeichen: fängt eine als
 *                                „Einkommen“ kategorisierte NEGATIVE Buchung)
 *  4. positiver Betrag         → income
 *  5. Sparen-Kategorie         → saving_investment  (eigener flexibler Puffer)
 *  6. essenziell/diskretionaer → variable_consumption
 *  7. sonst                    → uncategorized  (Zuordnungsproblem, nicht prognostizieren)
 */
export function classifyForecastTreatment(
  transaction: Transaction,
  ctx: ForecastTreatmentContext,
): ForecastTreatment {
  if (transaction.is_transfer) return 'transfer';
  if (transaction.is_contract) return 'fixed_recurring';
  if (ctx.excludedFingerprints?.has(merchantFingerprint(transaction))) return 'fixed_recurring';

  // Unterkategorie hat Vorrang vor der Hauptkategorie (Fallback).
  const klasse =
    resolveAusgabenklasse(ctx.categoriesById, transaction.subcategory_id) ??
    resolveAusgabenklasse(ctx.categoriesById, transaction.category_id);

  if (klasse === 'einkommen') return 'income';
  if (transaction.amount >= 0) return 'income';
  if (klasse === 'sparen') return 'saving_investment';
  if (klasse === 'essenziell' || klasse === 'diskretionaer') return 'variable_consumption';

  // Bewusst zugeordnete Kategorie ohne (auflösbare) Klasse – etwa eine
  // nutzererstellte Kategorie – ist ein echter Konsumposten, kein
  // Zuordnungsproblem. Nur eine gänzlich fehlende Kategorie gilt als unkategorisiert.
  const hasResolvableCategory =
    (transaction.subcategory_id != null && ctx.categoriesById.has(transaction.subcategory_id)) ||
    (transaction.category_id != null && ctx.categoriesById.has(transaction.category_id));
  if (hasResolvableCategory) return 'variable_consumption';

  return 'uncategorized';
}
