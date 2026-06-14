import type { Ausgabenklasse, Category, Rhythmus, Transaction } from '@/types';

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
}

/** Initialisiert den bearbeitbaren Entwurf aus einer Transaktion. */
export function draftFromTransaction(tx: Transaction): TransactionDetailDraft {
  return {
    category_id: tx.category_id ?? null,
    subcategory_id: tx.subcategory_id ?? null,
    is_contract: tx.is_contract ?? false,
    contract_cycle: tx.contract_cycle ?? null,
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

  return patch;
}
