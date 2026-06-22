import type { Ausgabenklasse, Category, Rhythmus, Transaction } from '@/types';
import type { CategorizationResult } from '@/services/transaction-service';

/**
 * Reine, testbare Logik für das Transaktions-Detail-Modal. Bewusst frei von
 * React, damit Kategorie-Auflösung, Vertrags-Diffing und Labels isoliert
 * getestet werden können (das Projekt testet Logik, nicht das DOM).
 */

export const AUSGABENKLASSE_LABEL: Record<Ausgabenklasse, string> = {
  essenziell: 'Essenziell',
  diskretionaer: 'Nicht-Essenziell',
  sparen: 'Sparen',
  einkommen: 'Einkommen',
};

export const RHYTHMUS_LABEL: Record<Rhythmus, string> = {
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Vierteljährlich',
  yearly: 'Jährlich',
};

export const RHYTHMUS_OPTIONS: { value: Rhythmus; label: string }[] = [
  { value: 'weekly', label: RHYTHMUS_LABEL.weekly },
  { value: 'monthly', label: RHYTHMUS_LABEL.monthly },
  { value: 'quarterly', label: RHYTHMUS_LABEL.quarterly },
  { value: 'yearly', label: RHYTHMUS_LABEL.yearly },
];

/** Übersetzt eine (ggf. null) Ausgabenklasse in ein Anzeige-Label. */
export function ausgabenklasseLabel(klasse: Ausgabenklasse | null | undefined): string {
  if (!klasse) return 'Unkategorisiert';
  return AUSGABENKLASSE_LABEL[klasse];
}

export interface CategorySelection {
  category_id: string | null;
  subcategory_id: string | null;
}

/**
 * Der Two-Step-Select liefert genau eine ID (Haupt- ODER Unterkategorie).
 * Diese Funktion löst daraus das Paar (category_id, subcategory_id) auf:
 * - Hauptkategorie gewählt → category_id gesetzt, subcategory_id null
 * - Unterkategorie gewählt → category_id = parent, subcategory_id = gewählte ID
 * - nichts gewählt → beide null
 */
export function resolveCategorySelection(
  categoriesById: Map<string, Category>,
  selectedId: string | null | undefined
): CategorySelection {
  if (!selectedId) return { category_id: null, subcategory_id: null };
  const cat = categoriesById.get(selectedId);
  if (!cat) return { category_id: null, subcategory_id: null };
  if (cat.parent_id) {
    return { category_id: cat.parent_id, subcategory_id: cat.id };
  }
  return { category_id: cat.id, subcategory_id: null };
}

/**
 * Liefert die ID, die der Two-Step-Select aktuell anzeigen soll: bevorzugt die
 * Unterkategorie, sonst die Hauptkategorie.
 */
export function currentCategoryValue(tx: Pick<Transaction, 'category_id' | 'subcategory_id'>): string {
  return tx.subcategory_id || tx.category_id || '';
}

export interface TransactionDetailDraft {
  category_id: string | null;
  subcategory_id: string | null;
  is_contract: boolean;
  contract_cycle: Rhythmus | null;
  /**
   * Manuelle Markierung als interner Übertrag. Optional, damit bestehende
   * Entwürfe ohne dieses Feld unverändert funktionieren.
   */
  is_transfer?: boolean;
}

/**
 * Sicherheitsstufe einer heuristischen Kategorisierung – die UI zeigt bewusst
 * Stufen statt Prozentwerte (Confidence ist eine Heuristik, kein Modell).
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export const CONFIDENCE_LEVEL_LABEL: Record<ConfidenceLevel, string> = {
  high: 'Hohe Sicherheit',
  medium: 'Mittlere Sicherheit',
  low: 'Niedrige Sicherheit',
};

export function confidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

export interface DetailCategorySuggestion {
  categoryId: string;
  categoryLabel: string;
  reasons: string[];
  confidenceLevel: ConfidenceLevel;
}

/**
 * Baut – falls sinnvoll – einen Kategorie-Vorschlag für das Detail-Modal.
 *
 * Bewusst eine reine Funktion (kein DOM/React), die ein bereits berechnetes
 * `CategorizationResult` (aus `explainCategorization`) entgegennimmt. Vorschlag
 * nur, wenn:
 *  - ein Kandidat existiert,
 *  - die Sicherheit < 0.85 ist (hohe Sicherheit bleibt stille Zuordnung) und
 *  - die Buchung noch nicht kategorisiert ist (Nutzerwahl wird nie überschrieben).
 */
export function buildDetailCategorySuggestion(
  tx: Pick<Transaction, 'category_id' | 'subcategory_id'>,
  result: CategorizationResult,
  categoriesById: Map<string, Category>,
): DetailCategorySuggestion | null {
  if (!result.categoryId) return null;
  if (result.confidence >= 0.85) return null;
  if (tx.category_id || tx.subcategory_id) return null;

  const category = categoriesById.get(result.categoryId);
  return {
    categoryId: result.categoryId,
    categoryLabel: category?.name ?? 'Vorgeschlagene Kategorie',
    reasons: result.reasons,
    confidenceLevel: confidenceLevel(result.confidence),
  };
}

export interface ContractHint {
  reason: string;
  occurrences: number;
}

function normalizePayeeForHint(payee: string | null | undefined): string {
  return (payee || '').toLowerCase().trim();
}

/**
 * Leichte, reine Heuristik: wirkt eine Buchung wie ein wiederkehrender Vertrag?
 *
 * Signal ist ein gleicher Empfänger mit ähnlichem Betrag (Toleranz 15 %, mind.
 * 0,50 €) in **mehreren verschiedenen Monaten**. Es werden bewusst Monate statt
 * roher Treffer gezählt, damit Mehrfachbuchungen am selben Tag nicht als
 * „wiederkehrend“ durchgehen. Liefert `null`, wenn bereits als Vertrag markiert
 * oder das Signal zu schwach ist (keine Bevormundung – nur ein Hinweis).
 */
export function buildContractHint(
  tx: Pick<Transaction, 'payee' | 'amount'>,
  isContractDraft: boolean,
  allTransactions: Pick<Transaction, 'payee' | 'amount' | 'date' | 'is_transfer'>[],
  minOccurrences = 3,
): ContractHint | null {
  if (isContractDraft) return null;

  const refPayee = normalizePayeeForHint(tx.payee);
  if (!refPayee) return null;

  const refAmount = Math.abs(tx.amount);
  if (refAmount === 0) return null;
  const tolerance = Math.max(0.5, refAmount * 0.15);

  const months = new Set<string>();
  for (const t of allTransactions) {
    if (t.is_transfer) continue;
    if (normalizePayeeForHint(t.payee) !== refPayee) continue;
    if (Math.sign(t.amount) !== Math.sign(tx.amount)) continue;
    if (Math.abs(Math.abs(t.amount) - refAmount) > tolerance) continue;
    if (t.date) months.add(t.date.slice(0, 7));
  }

  if (months.size < minOccurrences) return null;

  const payeeLabel = tx.payee || 'diesem Empfänger';
  return {
    reason: `${months.size} ähnliche Buchungen bei „${payeeLabel}“ über mehrere Monate erkannt.`,
    occurrences: months.size,
  };
}

/** Initialisiert den bearbeitbaren Entwurf aus einer Transaktion. */
export function draftFromTransaction(tx: Transaction): TransactionDetailDraft {
  return {
    category_id: tx.category_id ?? null,
    subcategory_id: tx.subcategory_id ?? null,
    is_contract: tx.is_contract ?? false,
    contract_cycle: tx.contract_cycle ?? null,
    is_transfer: tx.is_transfer ?? false,
  };
}

/**
 * Berechnet das Minimal-Diff zwischen Original-Transaktion und Entwurf. Nur
 * tatsächlich geänderte Felder landen im Patch (vermeidet unnötige Writes).
 * Wird `is_contract` deaktiviert, wird auch der Zyklus auf null gesetzt.
 */
export function diffTransactionDraft(
  tx: Transaction,
  draft: TransactionDetailDraft
): Partial<Transaction> {
  const patch: Partial<Transaction> = {};

  const normalizedCycle = draft.is_contract ? draft.contract_cycle : null;

  if ((tx.category_id ?? null) !== draft.category_id) {
    patch.category_id = draft.category_id;
  }
  if ((tx.subcategory_id ?? null) !== draft.subcategory_id) {
    patch.subcategory_id = draft.subcategory_id;
  }
  if ((tx.is_contract ?? false) !== draft.is_contract) {
    patch.is_contract = draft.is_contract;
  }
  if ((tx.contract_cycle ?? null) !== normalizedCycle) {
    patch.contract_cycle = normalizedCycle;
  }

  // Transfer-Markierung nur berücksichtigen, wenn der Entwurf das Feld kennt.
  // Wird die Markierung entfernt, wird zugleich eine evtl. vorhandene
  // Gegenbuchungs-Verknüpfung gelöst (kein Pair ohne Transfer).
  if (draft.is_transfer !== undefined && (tx.is_transfer ?? false) !== draft.is_transfer) {
    patch.is_transfer = draft.is_transfer;
    if (!draft.is_transfer) {
      patch.transfer_pair_id = null;
    }
  }

  return patch;
}
